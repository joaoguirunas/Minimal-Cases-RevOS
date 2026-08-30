/**
 * FORM PRO™ — Form Submission Handler
 *
 * POST /lp-submit
 * Body: { _form_id, _utm_source?, _utm_medium?, ..., [field_id]: value }
 *
 * CRM field namespaces:
 *   pessoa.*   → clients_people columns
 *   empresa.*  → clients_companies upsert + junction
 *   score.*    → clients_people score FK columns + async re-evaluation
 *   custom.*   → lead_field_values via upsert_crm_field_value RPC
 *
 * Backward-compat: bare keys (nome, email, telefone, observacoes) map to pessoa.*
 *
 * Flow:
 *   1. Validate required fields
 *   2. Rate limit by IP (max 10/min)
 *   3. Insert form_pro_submissions
 *   4. Map CRM fields → namespace buckets
 *   5. Upsert clients_people
 *   6. Upsert clients_companies + junction (if empresa.* fields present)
 *   7. Apply score.* FK fields + async re-evaluation
 *   8. Persist custom.* fields via RPC
 *   9. Create lead in leads (pipeline + first stage, no duplicates per pipeline)
 *  10. Post-submit actions (OMNI messages)
 *  11. Return { success: true, redirect_url }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { APPEND_ON_CONFLICT_FIELDS } from '../_shared/crm-mapper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RATE_LIMIT_MAX = 10;

/**
 * Persistent rate limiter using form_pro_rate_limits table.
 * Survives cold starts — unlike in-memory Map.
 * Lazy cleanup: deletes expired entries for this IP on each check.
 */
async function checkRateLimit(
  ip: string,
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();

  // Lazy cleanup: delete expired entries for this IP (non-blocking perf)
  supabase
    .from('form_pro_rate_limits')
    .delete()
    .eq('ip', ip)
    .lt('ts', windowStart)
    .then(() => null)
    .catch(() => null);

  // Count hits in current window
  const { count, error } = await supabase
    .from('form_pro_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('ts', windowStart);

  if (error) {
    // Fail-closed: block request if rate limit check fails (prevents abuse during DB outage)
    console.error('rate-limit check error (blocking request):', error);
    return false;
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX) return false;

  // Record this hit
  await supabase.from('form_pro_rate_limits').insert({ ip });
  return true;
}

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  crm_field?: string;
}

interface WhatsappAuto {
  enabled: boolean;
  channel_id: string;
  template_id: string;
  /** "1" → "field:pessoa.nome" | "fixed:Olá" */
  variable_map: Record<string, string>;
}

interface PostSubmitAction {
  id: string;
  enabled: boolean;
  channel: 'whatsapp' | 'email' | 'sms' | 'text';
  delay_minutes: number;
  // WhatsApp:
  wa_channel_id?: string;
  wa_template_id?: string;
  wa_variable_map?: Record<string, string>;
  // Email/SMS webhook:
  webhook_id?: string;
  message_template?: string;
  subject?: string;
  // Score-based filtering (by score_matrix entry):
  score_filter?: { mode: 'all' | 'include' | 'exclude'; matrix_ids: string[] };
}

interface FormSettings {
  submit_text: string;
  success_message: string;
  success_title?: string;
  redirect_url?: string;
  initial_stage_id?: string;
  default_team_id?: string;
  default_user_id?: string;
  whatsapp_auto?: WhatsappAuto;
  post_submit_actions?: PostSubmitAction[];
  success_routes?: SuccessRoute[];
}

interface SuccessRoute {
  id: string;
  matrix_ids: string[];
  action: 'message' | 'redirect' | 'booking';
  title?: string;
  message?: string;
  redirect_url?: string;
  booking_rule_set_id?: string;
  wa_confirm_template?: string;
}

// ── Namespace buckets ──────────────────────────────────────────────────────────

interface PessoaBucket {
  nome?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  notas?: string;
  documento?: string;
}

interface EmpresaBucket {
  nome?: string;
  site?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
}

// score.* — generic map: key (legacy slug or category UUID) → item UUID
type ScoreBucket = Record<string, string>;

interface UtmBucket {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

// crm_field → column mapping helpers
const PESSOA_COLUMN_MAP: Record<string, string> = {
  nome:      'name',
  email:     'email',
  whatsapp:  'whatsapp',
  instagram: 'instagram_handle',   // form captures @handle, not Meta numeric ID
  telefone:  'telefone',           // distinct from whatsapp — landline/alternative phone
  notas:     'notes',
  documento: 'document',
  objetivo:  'goal',               // maps pessoa.objetivo → clients_people.goal
  momento:   'moment',             // maps pessoa.momento → clients_people.moment (nicho/segmento)
};

const EMPRESA_COLUMN_MAP: Record<string, string> = {
  nome:     'trade_name',
  site:     'website',
  cnpj:     'tax_id',
  telefone: 'phone',
  email:    'email',
};

// (SCORE_COLUMN_MAP removed — old FK columns dropped in migration 20260312120000)
// Score is now resolved via score_category_items → score_matrix.category_selections JSONB

/** Extract unique positional {{N}} numbers from a text string, in order of appearance. */
function extractPositionals(text: string): number[] {
  const seen = new Set<number>();
  const nums: number[] = [];
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) {
    const n = Number(m[1]);
    if (!seen.has(n)) { seen.add(n); nums.push(n); }
  }
  return nums;
}

/** Extract unique named {{word}} vars from a text string, in order of appearance. */
function extractNamedVars(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); names.push(m[1]); }
  }
  return names;
}

/**
 * Build Meta-API components array from template json_data.
 * Handles both NAMED ({{nome}}) and POSITIONAL ({{1}}) parameter formats.
 * - For NAMED: namedResolver(varName) → resolved string value
 * - For POSITIONAL: resolvedValues[n-1] → resolved string value
 */
function buildTemplateComponents(
  jsonData: Record<string, unknown> | null,
  resolvedValues: string[],
  namedResolver: (varName: string) => string,
): Array<Record<string, unknown>> {
  // Auto-detect: explicit NAMED flag, OR infer from variables in template text
  // (handles templates synced before parameter_format was stored)
  let isNamed = (jsonData?.parameter_format as string) === 'NAMED';
  if (!isNamed && jsonData && Array.isArray(jsonData.components)) {
    // Check if any component uses non-numeric {{word}} vars (named format)
    const hasNamedVars = (jsonData.components as Array<Record<string, unknown>>).some((c) => {
      const text = typeof c.text === 'string' ? c.text : '';
      // Has {{word}} but NOT {{digit}} — indicates named format
      return /\{\{[a-zA-Z_]\w*\}\}/.test(text);
    });
    if (hasNamedVars) isNamed = true;
  }
  const getPositional = (n: number) => resolvedValues[n - 1] ?? '';

  const makeNamedParam = (varName: string): Record<string, string> => ({
    type: 'text',
    text: namedResolver(varName),
    parameter_name: varName,
  });

  if (jsonData && Array.isArray(jsonData.components)) {
    const result: Array<Record<string, unknown>> = [];

    for (const component of jsonData.components as Array<Record<string, unknown>>) {
      const ctype = (component.type as string)?.toUpperCase();

      if (ctype === 'HEADER' && (component.format as string)?.toUpperCase() === 'TEXT' && typeof component.text === 'string') {
        if (isNamed) {
          const vars = extractNamedVars(component.text);
          if (vars.length > 0) result.push({ type: 'header', parameters: vars.map(makeNamedParam) });
        } else {
          const nums = extractPositionals(component.text);
          if (nums.length > 0) result.push({ type: 'header', parameters: nums.map((n) => ({ type: 'text', text: getPositional(n) })) });
        }
      }

      if (ctype === 'BODY' && typeof component.text === 'string') {
        if (isNamed) {
          const vars = extractNamedVars(component.text);
          if (vars.length > 0) result.push({ type: 'body', parameters: vars.map(makeNamedParam) });
        } else {
          const nums = extractPositionals(component.text);
          if (nums.length > 0) result.push({ type: 'body', parameters: nums.map((n) => ({ type: 'text', text: getPositional(n) })) });
        }
      }

      if (ctype === 'BUTTONS' && Array.isArray(component.buttons)) {
        (component.buttons as Array<Record<string, unknown>>).forEach((btn, idx) => {
          if (btn.type === 'URL' && typeof btn.url === 'string') {
            if (isNamed) {
              extractNamedVars(btn.url).forEach((v) => {
                result.push({ type: 'button', sub_type: 'url', index: String(idx), parameters: [makeNamedParam(v)] });
              });
            } else {
              extractPositionals(btn.url).forEach((n) => {
                result.push({ type: 'button', sub_type: 'url', index: String(idx), parameters: [{ type: 'text', text: getPositional(n) }] });
              });
            }
          }
        });
      }
    }

    if (result.length > 0) return result;
  }

  // Fallback: put everything in body (legacy / unknown format)
  return resolvedValues.length > 0
    ? [{ type: 'body', parameters: resolvedValues.map((v) => ({ type: 'text', text: v })) }]
    : [];
}

/**
 * Render the BODY text of a WhatsApp template for display in OMNI.
 * Handles both POSITIONAL {{1}} and NAMED {{nome}} placeholder formats.
 */
function renderWaTemplateBody(
  jsonData: Record<string, unknown> | null,
  resolvedValues: string[],
  namedResolver: (varName: string) => string,
): string {
  if (!jsonData) return '';

  let bodyText = '';
  // Auto-detect named format: explicit flag OR infer from non-numeric {{word}} vars
  let isNamed = (jsonData.parameter_format as string) === 'NAMED';
  if (!isNamed && Array.isArray(jsonData.components)) {
    const hasNamedVars = (jsonData.components as Array<Record<string, unknown>>).some((c) => {
      const text = typeof c.text === 'string' ? c.text : '';
      return /\{\{[a-zA-Z_]\w*\}\}/.test(text);
    });
    if (hasNamedVars) isNamed = true;
  }

  if (Array.isArray(jsonData.components)) {
    for (const component of jsonData.components as Array<Record<string, unknown>>) {
      const ctype = (component.type as string)?.toUpperCase();
      if (ctype === 'BODY' && typeof component.text === 'string') {
        bodyText = component.text;
        break;
      }
    }
  }

  if (!bodyText) {
    let containerMeta: Record<string, unknown> = {};
    try {
      if (jsonData.containerMeta) {
        containerMeta = typeof jsonData.containerMeta === 'string'
          ? JSON.parse(jsonData.containerMeta as string)
          : (jsonData.containerMeta as Record<string, unknown>);
      }
    } catch { /* ignore */ }
    bodyText = (containerMeta.data as string) || (jsonData.data as string) || '';
  }

  if (bodyText) {
    if (isNamed) {
      bodyText = bodyText.replace(/\{\{(\w+)\}\}/g, (_, varName) => namedResolver(varName));
    } else if (resolvedValues.length > 0) {
      bodyText = bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => resolvedValues[Number(n) - 1] ?? '');
    }
  }

  return bodyText;
}

// Normalize phone to E.164: adds country code 55 (Brazil) if absent
function normalizePhone(raw: string, countryCode = '55'): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Already has country code if length >= 12 and starts with countryCode
  if (digits.startsWith(countryCode) && digits.length >= 12) return digits;
  // Strip leading 0 (old trunk format)
  const cleaned = digits.startsWith('0') ? digits.slice(1) : digits;
  return countryCode + cleaned;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, errors: { _: 'Method not allowed' } }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const log = createLogger('lp-submit');

  // Control-plane client (for rate limiting + tenant lookup)
  const cpSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Rate limiting (persistent — survives cold starts)
  const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const ip = /^[\d.:%a-fA-F]{3,45}$/.test(rawIp) ? rawIp : 'unknown';
  if (!(await checkRateLimit(ip, cpSupabase))) {
    return new Response(
      JSON.stringify({ success: false, errors: { _: 'Too many submissions. Try again in a minute.' } }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders } }
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, errors: { _: 'Invalid JSON body' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // Multi-tenant: resolve the correct database client.
  // If _client_id is provided, look up the tenant's decrypted credentials via RPC.
  let supabase = cpSupabase;
  const clientId = body._client_id;
  if (clientId) {
    const { data: secrets, error: secretsErr } = await cpSupabase
      .rpc('adm_client_decrypted_secrets', { p_client_id: clientId });

    if (secretsErr) {
      log.warn(`Failed to decrypt tenant secrets for client ${clientId}: ${secretsErr.message}`);
    } else if (secrets && secrets.length > 0 && secrets[0].service_role_key) {
      // Get the tenant's supabase_url from adm_clients
      const { data: clientRow } = await cpSupabase
        .from('adm_clients')
        .select('supabase_url')
        .eq('id', clientId)
        .single();

      if (clientRow?.supabase_url) {
        supabase = createClient(clientRow.supabase_url, secrets[0].service_role_key);
        log.info(`Routing to tenant: ${clientRow.supabase_url}`);
      }
    } else {
      log.warn(`Tenant secrets not found for client ${clientId}, falling back to control-plane`);
    }
  }
  // Remove _client_id from body so it's not treated as a form field
  delete body._client_id;

  // _form_id is required; _page_id is optional (standalone/embedded forms may not have it)
  const isPartial = body._partial === 'true' || body._partial === true;
  const formId = body._form_id;
  if (!formId) {
    return new Response(JSON.stringify({ success: false, errors: { _: 'Missing form_id' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
  let pageId = body._page_id || '';

  // FORM PRO: no pages, page_id is always null
  pageId = null;

  // Fetch form config for validation
  const { data: form, error: formErr } = await supabase
    .from('form_pro_forms')
    .select('*')
    .eq('id', formId)
    .single();

  if (formErr || !form) {
    return new Response(JSON.stringify({ success: false, errors: { _: 'Form not found' } }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const fields: FormField[] = form.fields ?? [];
  const settings: FormSettings = form.settings ?? { submit_text: 'Enviar', success_message: 'Obrigado!' };
  const pipelineId: string | null = form.pipeline_id ?? null;
  // Etapa inicial configurada no formulário (sobrescreve busca pela primeira etapa)
  const configuredStageId: string | null = settings.initial_stage_id ?? null;
  // Team/user defaults from form settings (ensures leads appear in CRM Kanban for non-managers)
  const configuredTeamId: string | null = settings.default_team_id ?? null;
  const configuredUserId: string | null = settings.default_user_id ?? null;

  // ── 1. Server-side validation ──────────────────────────────────────────────
  // Partial submits only validate fields explicitly included in the body (step 1 fields only)
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'hidden') continue;
    const value = body[field.id] ?? '';
    const fieldPresent = body[field.id] !== undefined;
    if (field.required && !value.trim() && (!isPartial || fieldPresent)) {
      errors[field.id] = `${field.label} é obrigatório`;
    }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) {
      errors[field.id] = `${field.label}: e-mail inválido`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return new Response(JSON.stringify({ success: false, errors }),
      { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // Build submission data (sanitize: trim strings, filter null/undefined, cap length)
  const MAX_FIELD_LENGTH = 5000;
  const submissionData: Record<string, string> = {};
  for (const field of fields) {
    const raw = body[field.id];
    if (raw !== undefined && raw !== null) {
      const val = typeof raw === 'string' ? raw.trim().slice(0, MAX_FIELD_LENGTH) : String(raw).slice(0, MAX_FIELD_LENGTH);
      submissionData[field.id] = val;
    }
  }

  // ── 2. Insert lp_submission (non-blocking — CRM processing continues even if this fails) ──
  // page_id is nullable (migration 20260308130000): standalone/embedded forms get page_id=null.
  let submission: { id: string } | null = null;
  {
    const { data: sub, error: subErr } = await supabase
      .from('form_pro_submissions')
      .insert({
        page_id: pageId || null,
        form_id: formId,
        source: 'site',
        data: submissionData,
        utm_source: body._utm_source || null,
        utm_medium: body._utm_medium || null,
        utm_campaign: body._utm_campaign || null,
        utm_content: body._utm_content || null,
        utm_term: body._utm_term || null,
        // Click IDs for conversion tracking (captured natively by PublicFormPage)
        gclid: body._gclid || null,
        fbclid: body._fbclid || null,
        fbc: body._fbc || null,
        fbp: body._fbp || null,
        ip_address: ip === 'unknown' ? null : ip,
        user_agent: req.headers.get('user-agent'),
      })
      .select('id')
      .single();
    if (subErr) {
      console.error('lp-submit: insert submission error (non-blocking):', subErr);
    } else {
      submission = sub;
    }
  }

  // ── 3. Build namespace-aware CRM field mapping ─────────────────────────────
  const pessoa: PessoaBucket = {};
  const empresa: EmpresaBucket = {};
  const score: ScoreBucket = {};
  const utmFields: UtmBucket = {};
  const customFields: { key: string; value: string }[] = [];

  for (const field of fields) {
    let raw = field.crm_field;
    const val = body[field.id];
    if (!val) continue;

    // Auto-map by field type when crm_field is not explicitly configured
    if (!raw) {
      if (field.type === 'phone') raw = 'pessoa.whatsapp';
      else if (field.type === 'email') raw = 'pessoa.email';
      else continue;
    }

    // Normalize legacy bare keys → pessoa.* namespace
    const crmField = raw.includes('.') ? raw : `pessoa.${
      raw === 'nome' ? 'nome' :
      raw === 'email' ? 'email' :
      raw === 'telefone' ? 'whatsapp' :
      raw === 'observacoes' ? 'notas' :
      raw
    }`;

    const [ns, key] = crmField.split('.');

    if (ns === 'pessoa') {
      (pessoa as Record<string, string>)[key] = val;
    } else if (ns === 'empresa') {
      (empresa as Record<string, string>)[key] = val;
    } else if (ns === 'score') {
      (score as Record<string, string>)[key] = val;
    } else if (ns === 'utm') {
      (utmFields as Record<string, string>)[key] = val;
    } else if (ns === 'custom') {
      customFields.push({ key, value: val });
    }
  }

  // Merge UTM fields: body-level _utm_* take priority, fallback to utm.* form fields
  if (!body._utm_source && utmFields.source) body._utm_source = utmFields.source;
  if (!body._utm_medium && utmFields.medium) body._utm_medium = utmFields.medium;
  if (!body._utm_campaign && utmFields.campaign) body._utm_campaign = utmFields.campaign;
  if (!body._utm_content && utmFields.content) body._utm_content = utmFields.content;
  if (!body._utm_term && utmFields.term) body._utm_term = utmFields.term;

  // ── 4. Attribution source string ───────────────────────────────────────────
  const formName = (form.name as string | undefined) ?? formId;
  const utmSource = body._utm_source;
  const lpSource = utmSource ? `form_pro:${formName}:${utmSource}` : `form_pro:${formName}`;

  // ── 5. Upsert clients_people ───────────────────────────────────────────────
  let personId: string | null = null;

  if (pessoa.email || pessoa.nome || pessoa.whatsapp) {
    // name is NOT NULL in DB — always provide a fallback
    const personName = pessoa.nome || pessoa.email?.split('@')[0] || 'Lead LP PRO™';

    // Normalize WhatsApp: ensure E.164 with Brazil country code (55)
    if (pessoa.whatsapp) {
      pessoa.whatsapp = normalizePhone(pessoa.whatsapp);
    }

    // Try to find existing person by email first, then by whatsapp
    if (pessoa.email || pessoa.whatsapp) {
      const selectCols = 'id, score_matrix_id';

      if (pessoa.email) {
        const { data: byEmail } = await supabase
          .from('clients_people')
          .select(selectCols)
          .eq('email', pessoa.email)
          .neq('status', 'merged')
          .maybeSingle();
        if (byEmail) {
          personId = byEmail.id;
        }
      }

      if (!personId && pessoa.whatsapp) {
        const { data: byPhone } = await supabase
          .from('clients_people')
          .select(selectCols)
          .eq('whatsapp', pessoa.whatsapp)
          .neq('status', 'merged')
          .maybeSingle();
        if (byPhone) personId = byPhone.id;
      }

      if (personId) {
        // Update existing person
        const updatePayload: Record<string, string | null> = { source: lpSource };
        for (const [key, col] of Object.entries(PESSOA_COLUMN_MAP)) {
          const val = (pessoa as Record<string, string | undefined>)[key];
          if (val !== undefined) updatePayload[col] = val;
        }
        const { error: updErr } = await supabase
          .from('clients_people')
          .update(updatePayload)
          .eq('id', personId);
        if (updErr) console.error('lp-submit: update clients_people error:', updErr);
      }
    }

    if (!personId) {
      // Insert new person — name is required (NOT NULL)
      const insertPayload: Record<string, string | null> = {
        source: lpSource,
        name: personName,  // guaranteed non-null fallback
      };
      for (const [key, col] of Object.entries(PESSOA_COLUMN_MAP)) {
        if (col === 'name') continue; // already set above with fallback
        const val = (pessoa as Record<string, string | undefined>)[key];
        if (val !== undefined && val !== null && val !== '') insertPayload[col] = val;
      }

      const { data: newPerson, error: insErr } = await supabase
        .from('clients_people')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) {
        console.error('lp-submit: insert clients_people error:', insErr, 'payload:', JSON.stringify(insertPayload));
      } else if (newPerson) {
        personId = newPerson.id;
      }
    }
  }

  // ── 6. Upsert clients_companies + junction ─────────────────────────────────
  let companyId: string | null = null; // hoisted — used in step 9 for leads.company_id

  if (personId && empresa.nome) {
    // Build company payload
    const companyPayload: Record<string, string | null> = {};
    for (const [key, col] of Object.entries(EMPRESA_COLUMN_MAP)) {
      const val = (empresa as Record<string, string | undefined>)[key];
      if (val !== undefined) companyPayload[col] = val;
    }

    // Dedup: prefer tax_id (CNPJ) match, fallback to case-insensitive trade_name trim
    const normalizedName = empresa.nome.trim();
    let existingCompanyId: string | null = null;

    if (empresa.cnpj) {
      const cnpjDigits = empresa.cnpj.replace(/\D/g, '');
      if (cnpjDigits) {
        const { data: byCnpj } = await supabase
          .from('clients_companies')
          .select('id')
          .eq('tax_id', cnpjDigits)
          .maybeSingle();
        if (byCnpj) existingCompanyId = byCnpj.id;
      }
    }

    if (!existingCompanyId) {
      const { data: byName } = await supabase
        .from('clients_companies')
        .select('id')
        .ilike('trade_name', normalizedName)
        .maybeSingle();
      if (byName) existingCompanyId = byName.id;
    }

    if (existingCompanyId) {
      companyId = existingCompanyId;
      await supabase.from('clients_companies').update(companyPayload).eq('id', companyId);
    } else {
      const { data: newCompany } = await supabase
        .from('clients_companies')
        .insert({ ...companyPayload, trade_name: normalizedName })
        .select('id')
        .single();
      if (newCompany) companyId = newCompany.id;
    }

    // Link person ↔ company (upsert to avoid race condition on concurrent submissions)
    if (companyId) {
      const { error: linkErr } = await supabase
        .from('clients_people_companies')
        .upsert(
          { people_id: personId, company_id: companyId },
          { onConflict: 'people_id,company_id' },
        );
      if (linkErr) {
        // Fallback: if no unique constraint, try insert and ignore duplicate
        await supabase
          .from('clients_people_companies')
          .insert({ people_id: personId, company_id: companyId })
          .then(() => null)
          .catch(() => null);
      }
    }
  }

  // ── 7. Apply score (new JSONB system) ─────────────────────────────────────
  // score.* keys are either legacy slugs (objetivo/investimento/enquadramento) OR
  // category UUIDs (for new dynamic categories). Values are score_category_items.id.
  // Lookup: item IDs → category IDs → match score_matrix.category_selections JSONB.
  let appliedScore: number | null = null;
  let appliedMatrixId: string | null = null;
  const scoreItemIds = Object.values(score).filter(Boolean);
  if (personId && scoreItemIds.length > 0) {
    const { data: itemRows, error: itemErr } = await supabase
      .from('score_category_items')
      .select('id, category_id')
      .in('id', scoreItemIds);

    if (itemErr) {
      log.error('score: failed to resolve category items', { error: itemErr.message });
    } else if (itemRows && itemRows.length > 0) {
      // Build { categoryId: [itemId, ...] } — accumulate items per category
      const catSelections: Record<string, string[]> = {};
      for (const row of itemRows) {
        if (!catSelections[row.category_id]) {
          catSelections[row.category_id] = [];
        }
        catSelections[row.category_id].push(row.id);
      }

      // Find matching score matrix via JSONB containment (@>)
      const { data: matrixRows, error: matrixErr } = await supabase
        .from('score_matrix')
        .select('id, score_number')
        .contains('category_selections', catSelections)
        .limit(1);

      if (matrixErr) {
        log.error('score: matrix query failed', { error: matrixErr.message });
      } else if (matrixRows && matrixRows.length > 0) {
        const matrix = matrixRows[0];
        const { error: scoreUpdateErr } = await supabase
          .from('clients_people')
          .update({ score_matrix_id: matrix.id, score: matrix.score_number })
          .eq('id', personId);
        if (scoreUpdateErr) {
          log.error('score: update clients_people failed', { error: scoreUpdateErr.message });
        } else {
          appliedScore = matrix.score_number;
          appliedMatrixId = matrix.id;
          log.info('score: matrix matched and applied', { matrixId: matrix.id, score: matrix.score_number });
        }
      } else {
        log.info('score: no matrix match found', { catSelections });
      }
    }

    // ── 7b. Backfill goal/moment from score category item names ───────────
    // If the form used score.objetivo or score.investimento (category items)
    // but did NOT set pessoa.objetivo / pessoa.momento directly, resolve the
    // item names and persist them to clients_people.goal / .moment so the
    // AI agent has human-readable context for its opening message.
    const scoreKeys = Object.keys(score);
    const objetivoItemId = score['objetivo'] || score['objectives'] || null;
    const momentoItemId = score['momento'] || score['enquadramento'] || score['framing'] || null;

    const backfillIds: string[] = [];
    if (objetivoItemId && !pessoa.objetivo) backfillIds.push(objetivoItemId);
    if (momentoItemId && !pessoa.momento) backfillIds.push(momentoItemId);

    // Also check for nicho/segmento in score keys (dynamic category slug)
    const nichoKey = scoreKeys.find(k => k === 'nicho' || k === 'segmento');
    const nichoItemId = nichoKey ? score[nichoKey] : null;
    if (nichoItemId && !pessoa.momento) backfillIds.push(nichoItemId);

    if (backfillIds.length > 0) {
      const { data: itemNames } = await supabase
        .from('score_category_items')
        .select('id, name, category:score_categories!inner(slug)')
        .in('id', backfillIds);

      if (itemNames && itemNames.length > 0) {
        const backfill: Record<string, string> = {};
        for (const item of itemNames) {
          const slug = (item.category as any)?.slug ?? '';
          if (item.id === objetivoItemId) {
            backfill.goal = item.name;
          } else if (item.id === momentoItemId || item.id === nichoItemId) {
            backfill.moment = item.name;
          }
        }
        if (Object.keys(backfill).length > 0) {
          await supabase.from('clients_people').update(backfill).eq('id', personId);
          log.info('score: backfilled goal/moment from category items', backfill);
        }
      }
    }
  }

  // ── 8. Persist custom.* fields ────────────────────────────────────────────
  // Append-on-conflict keys route through append_crm_field_value (DB-level
  // atomic concat with advisory lock). APPEND_ON_CONFLICT_FIELDS imported from
  // crm-mapper.ts (single source of truth). PIPE-3.2.
  if (personId && customFields.length > 0) {
    for (const cf of customFields) {
      // fire-and-forget per field — non-blocking
      if (APPEND_ON_CONFLICT_FIELDS.has(cf.key)) {
        supabase.rpc('append_crm_field_value', {
          p_person_id: personId,
          p_field_key: cf.key,
          p_new_value: cf.value,
        }).then(() => {/* no-op */}).catch(() => {/* non-blocking */});
      } else {
        supabase.rpc('upsert_crm_field_value', {
          p_person_id: personId,
          p_field_key: cf.key,
          p_value: cf.value,
        }).then(() => {/* no-op */}).catch(() => {/* non-blocking */});
      }
    }
  }

  // ── Partial submit: save contact only, skip lead + post-submit actions ─────
  // Used by multi-step forms to persist step 1 data immediately without
  // triggering lead creation, pipeline assignment, or post-submit messages.
  if (isPartial) {
    return new Response(
      JSON.stringify({ success: true, partial: true, person_id: personId }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  // ── 9. Create lead ─────────────────────────────────────────────────────────
  let leadId: string | null = null;
  let isExistingLead = false;

  if (personId) {
    // pessoa.nome = legacy key | pessoa.name = English key from newer forms
    const personName = (pessoa as Record<string,string>).nome
      || (pessoa as Record<string,string>).name
      || pessoa.email?.split('@')[0]
      || 'Lead LP PRO™';
    // Resolve initial stage: use configured stage or fall back to first active stage
    let firstStageId: string | null = configuredStageId;
    if (!firstStageId && pipelineId) {
      const { data: firstStage } = await supabase
        .from('leads_stages')
        .select('id')
        .eq('leads_pipelines_id', pipelineId)
        .eq('active', true)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstStage) firstStageId = firstStage.id;
    }

    // Resolve team/user: form settings → first team in system (fallback)
    let resolvedTeamId: string | null = configuredTeamId;
    let resolvedUserId: string | null = configuredUserId;
    if (!resolvedTeamId) {
      const { data: firstTeam } = await supabase
        .from('settings_teams')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstTeam) resolvedTeamId = firstTeam.id;
    }

    if (pipelineId) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('people_id', personId)
        .eq('leads_pipelines_id', pipelineId)
        .maybeSingle();

      if (existingLead) {
        leadId = existingLead.id;
        isExistingLead = true;
        const existingLeadUpdate: Record<string, unknown> = {
          utm_source: body._utm_source || null,
          utm_medium: body._utm_medium || null,
          utm_campaign: body._utm_campaign || null,
          utm_content: body._utm_content || null,
          utm_term: body._utm_term || null,
          gclid: body._gclid || null,
          fbclid: body._fbclid || null,
          description: `Origem: FORM PRO™ — ${formName}`,
          status: 'in_progress',
        };
        if (firstStageId) existingLeadUpdate.leads_stages_id = firstStageId;
        if (companyId) existingLeadUpdate.company_id = companyId;
        if (resolvedTeamId) existingLeadUpdate.teams_id = resolvedTeamId;
        if (resolvedUserId) existingLeadUpdate.user_id = resolvedUserId;
        // Try with extended cols first, fallback to core
        const extUpdate = { ...existingLeadUpdate, fbc: body._fbc || null, fbp: body._fbp || null, lead_source: 'site_form' };
        const { error: upd1 } = await supabase.from('leads').update(extUpdate).eq('id', leadId);
        if (upd1) {
          log.warn('lead update with extended cols failed, retrying core:', upd1.message);
          await supabase.from('leads').update(existingLeadUpdate).eq('id', leadId);
        }
      } else {
        // Core lead payload (columns guaranteed to exist on all tenants)
        const leadPayload: Record<string, unknown> = {
          people_id: personId,
          title: personName,
          leads_pipelines_id: pipelineId,
          leads_stages_id: firstStageId,
          company_id: companyId || null,
          teams_id: resolvedTeamId,
          user_id: resolvedUserId,
          status: 'in_progress',
          description: `Origem: FORM PRO™ — ${formName}`,
          utm_source: body._utm_source || null,
          utm_medium: body._utm_medium || null,
          utm_campaign: body._utm_campaign || null,
          utm_content: body._utm_content || null,
          utm_term: body._utm_term || null,
          gclid: body._gclid || null,
          fbclid: body._fbclid || null,
        };
        // Extended tracking columns (may not exist on older tenant schemas)
        const extendedPayload = { ...leadPayload, fbc: body._fbc || null, fbp: body._fbp || null, lead_source: 'site_form' };

        let newLead: { id: string } | null = null;
        const { data: d1, error: e1 } = await supabase.from('leads').insert(extendedPayload).select('id').single();
        if (e1) {
          // Retry without extended columns (tenant may lack fbc/fbp/lead_source)
          log.warn('lead insert with extended cols failed, retrying core-only:', e1.message);
          const { data: d2, error: e2 } = await supabase.from('leads').insert(leadPayload).select('id').single();
          if (e2) log.error('lead insert core-only also failed:', JSON.stringify(e2));
          else newLead = d2;
        } else {
          newLead = d1;
        }
        if (newLead) { leadId = newLead.id; }
      }
    } else {
      // No pipeline — still create lead without pipeline
      // Fallback: find first active pipeline in the system
      const { data: firstPipeline } = await supabase
        .from('leads_pipelines')
        .select('id')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const fallbackPipelineId = firstPipeline?.id ?? null;

      let fallbackStageId: string | null = null;
      if (fallbackPipelineId) {
        const { data: fs } = await supabase
          .from('leads_stages')
          .select('id')
          .eq('leads_pipelines_id', fallbackPipelineId)
          .eq('active', true)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle();
        fallbackStageId = fs?.id ?? null;
      }

      // Core lead payload (columns guaranteed to exist on all tenants)
      const fbLeadPayload: Record<string, unknown> = {
        people_id: personId,
        title: personName,
        leads_pipelines_id: fallbackPipelineId,
        leads_stages_id: fallbackStageId,
        company_id: companyId || null,
        teams_id: resolvedTeamId,
        user_id: resolvedUserId,
        status: 'in_progress',
        description: `Origem: FORM PRO™ — ${formName}`,
        utm_source: body._utm_source || null,
        utm_medium: body._utm_medium || null,
        utm_campaign: body._utm_campaign || null,
        utm_content: body._utm_content || null,
        utm_term: body._utm_term || null,
        gclid: body._gclid || null,
        fbclid: body._fbclid || null,
      };
      // Extended tracking columns (may not exist on older tenant schemas)
      const fbExtPayload = { ...fbLeadPayload, fbc: body._fbc || null, fbp: body._fbp || null, lead_source: 'site_form' };

      let newLead: { id: string } | null = null;
      const { data: fb1, error: fbErr1 } = await supabase.from('leads').insert(fbExtPayload).select('id').single();
      if (fbErr1) {
        log.warn('lead insert (no-pipeline) extended cols failed, retrying core-only:', fbErr1.message);
        const { data: fb2, error: fbErr2 } = await supabase.from('leads').insert(fbLeadPayload).select('id').single();
        if (fbErr2) log.error('lead insert (no-pipeline) core-only also failed:', JSON.stringify(fbErr2));
        else newLead = fb2;
      } else {
        newLead = fb1;
      }
      if (newLead) { leadId = newLead.id; }
    }

    // Update submission with lead_id + people_id
    if (submission) {
      await supabase
        .from('form_pro_submissions')
        .update({ lead_id: leadId ?? undefined, people_id: personId })
        .eq('id', submission.id);
    }

  }

  // ── 10. OMNI notification — form submission message ────────────────────────
  // Flag: if any pending WA message was inserted, trigger delivery engine immediately
  let shouldTriggerDelivery = false;
  // Insert a message so the conversation appears in OMNI with the form origin.
  if (personId) {
    const omniChannel = pessoa.whatsapp ? 'whatsapp' : pessoa.email ? 'email' : 'whatsapp';
    const rawFormLabel = (form.name as string | undefined) ?? 'formulário';
    // Cap form name at 200 chars so msg content fits in the conversation preview UIs
    // and never bloats `content` if a tenant nicknames a form with a huge string.
    const formLabel = rawFormLabel.slice(0, 200);
    const msgContent = `📋 Cadastro via formulário "${formLabel}"`;

    // Build readable field list for OMNI expand view.
    // Caps: 30 fields, 500 chars/value, 200 chars/label. Protects metadata JSONB
    // from inflating to MB-scale when a tenant has a textarea field with huge input.
    const FIELD_VALUE_MAX = 500;
    const FIELD_LABEL_MAX = 200;
    const FIELD_COUNT_MAX = 30;
    const formFieldsMeta = (fields as FormField[])
      .filter((f) => submissionData[f.id] !== undefined && String(submissionData[f.id]).trim() !== '')
      .slice(0, FIELD_COUNT_MAX)
      .map((f) => {
        const rawValue = String(submissionData[f.id] ?? '');
        const truncatedValue = rawValue.length > FIELD_VALUE_MAX
          ? `${rawValue.slice(0, FIELD_VALUE_MAX)}…`
          : rawValue;
        const rawLabel = String(f.label || f.id);
        const truncatedLabel = rawLabel.length > FIELD_LABEL_MAX
          ? `${rawLabel.slice(0, FIELD_LABEL_MAX)}…`
          : rawLabel;
        return { label: truncatedLabel, value: truncatedValue };
      });

    // INSERT with explicit timeout + 1 retry on transient failure.
    // The whole form submission shouldn't 5xx because of an Omni-side hiccup —
    // user must see success. But we want the message in DB if at all possible.
    const insertOmniMessage = async (): Promise<{ error: { message: string } | null }> => {
      const timeoutMs = 5000;
      const timer = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: 'omni message INSERT timeout (5s)' } }), timeoutMs),
      );
      const op = supabase.from('messages').insert({
        people_id: personId,
        lead_id: leadId ?? undefined,
        content: msgContent,
        channel: omniChannel,
        from_contact: 'cliente',
        source_type: 'form',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          form_name: formLabel,
          form_id: formId,
          submission_id: submission?.id ?? null,
          form_fields: formFieldsMeta,
        },
      }).then((r: { error: { message: string } | null }) => ({ error: r.error }));
      return Promise.race([op, timer]);
    };

    let { error: omniMsgErr } = await insertOmniMessage();
    if (omniMsgErr) {
      // One-shot retry on transient: keeps Omni history reliable without making the user wait.
      log.warn('omni form-origin message INSERT failed, retrying once', {
        personId,
        leadId,
        formId,
        error: omniMsgErr.message,
      });
      const retry = await insertOmniMessage();
      omniMsgErr = retry.error;
    }
    if (omniMsgErr) {
      log.error('omni form-origin message INSERT failed after retry', {
        personId,
        leadId,
        formId,
        error: omniMsgErr.message,
      });
    }
  }

  // ── 11. Post-submit actions → INSERT pending messages (OMNI handles dispatch) ──
  // LP PRO's sole responsibility: create message records with status='pending'.
  // OMNI delivery engine reads pending messages and handles all sending logic.
  // lp-submit does NOT call whatsapp-outbound, fetch external webhooks, or manage delays.
  if (personId) {
    const postActions = settings.post_submit_actions ?? [];
    const legacyWa = settings.whatsapp_auto;

    // Helper: resolve field spec "field:pessoa.nome" | "fixed:text"
    // Resolved here because only lp-submit has the pessoa.* / empresa.* / custom.* context.
    const resolveSpec = (spec: string): string => {
      if (!spec) return '';
      if (spec.startsWith('fixed:')) return spec.slice(6);
      if (spec.startsWith('field:')) {
        const ref = spec.slice(6);
        const [ns, key] = ref.split('.');
        if (ns === 'pessoa') return (pessoa as Record<string, string | undefined>)[key] ?? '';
        if (ns === 'empresa') return (empresa as Record<string, string | undefined>)[key] ?? '';
        if (ns === 'custom') return customFields.find((c) => c.key === key)?.value ?? '';
      }
      return '';
    };

    // Score filter: check if action should run for this score
    const shouldRunForMatrix = (action: PostSubmitAction, matrixId: string | null): boolean => {
      const f = action.score_filter;
      if (!f || f.mode === 'all') return true;
      if (matrixId === null) return true; // no matrix matched → run all
      if (f.mode === 'include') return f.matrix_ids.includes(matrixId);
      if (f.mode === 'exclude') return !f.matrix_ids.includes(matrixId);
      return true;
    };

    // Normalise into a unified action list:
    // new post_submit_actions supersede legacy whatsapp_auto when present.
    const actionsToProcess: PostSubmitAction[] = postActions.length > 0
      ? postActions.filter((a) => a.enabled && shouldRunForMatrix(a, appliedMatrixId))
      : (legacyWa?.enabled && legacyWa.channel_id && legacyWa.template_id)
        ? [{
            id: 'legacy-wa',
            enabled: true,
            channel: 'whatsapp' as const,
            delay_minutes: 0,
            wa_channel_id: legacyWa.channel_id,
            wa_template_id: legacyWa.template_id,
            wa_variable_map: legacyWa.variable_map,
          }]
        : [];

    log.info('post-submit actions', { count: actionsToProcess.length, personId, leadId });

    for (const action of actionsToProcess) {
      try {
        if (action.channel === 'whatsapp') {
          if (!pessoa.whatsapp) {
            log.warn('post-submit WA: no whatsapp on person — skip', { actionId: action.id });
            continue;
          }
          if (!action.wa_channel_id || !action.wa_template_id) {
            log.warn('post-submit WA: missing channel or template — skip', { actionId: action.id });
            continue;
          }

          // Só confirma que o canal existe — não exige phone_number_id (coluna
          // Meta-only, sempre null pra canais Evolution). `wa_phone_number_id`
          // abaixo grava o id do canal, que whatsapp-outbound resolve pros dois
          // providers via `.or(phone_number_id.eq.X,id.eq.X)`.
          const { data: channel } = await supabase
            .from('settings_whatsapp_channels')
            .select('id')
            .eq('id', action.wa_channel_id)
            .single();

          if (!channel) {
            log.warn('post-submit WA: channel not found', { channelId: action.wa_channel_id });
            continue;
          }

          // Fetch template name + language so delivery engine → whatsapp-outbound can dispatch correctly
          const { data: waTemplate } = await supabase
            .from('whatsapp_templates')
            .select('name, json_data')
            .eq('id', action.wa_template_id)
            .maybeSingle();

          const templateJsonData = waTemplate?.json_data as Record<string, unknown> | null ?? null;
          // Auto-detect named format: explicit flag OR infer from non-numeric {{word}} vars
          let isNamedTemplate = (templateJsonData?.parameter_format as string) === 'NAMED';
          if (!isNamedTemplate && templateJsonData && Array.isArray(templateJsonData.components)) {
            const hasNamedVars = (templateJsonData.components as Array<Record<string, unknown>>).some((c) => {
              const text = typeof c.text === 'string' ? c.text : '';
              return /\{\{[a-zA-Z_]\w*\}\}/.test(text);
            });
            if (hasNamedVars) isNamedTemplate = true;
          }

          // Smart defaults for NAMED templates: map common variable names to form fields
          const NAMED_SMART_DEFAULTS: Record<string, string> = {
            nome: pessoa.nome ?? '', name: pessoa.nome ?? '',
            email: pessoa.email ?? '',
            telefone: pessoa.whatsapp ?? '', phone: pessoa.whatsapp ?? '', whatsapp: pessoa.whatsapp ?? '',
          };

          // Named resolver: explicit wa_variable_map[varName] → resolveSpec → smart default → ' '
          const namedResolver = (varName: string): string => {
            const explicitSpec = (action.wa_variable_map ?? {})[varName];
            if (explicitSpec) return resolveSpec(explicitSpec) || NAMED_SMART_DEFAULTS[varName.toLowerCase()] || ' ';
            return NAMED_SMART_DEFAULTS[varName.toLowerCase()] || ' ';
          };

          // Positional resolved values (for POSITIONAL templates or legacy fallback)
          const resolvedValues: string[] = isNamedTemplate
            ? []
            : Object.keys(action.wa_variable_map ?? {})
                .sort((a, b) => Number(a) - Number(b))
                .map((idx) => resolveSpec((action.wa_variable_map ?? {})[idx]) || ' ');

          // Build properly structured components (HEADER + BODY + BUTTONS) from template json_data
          const templateComponents = buildTemplateComponents(
            templateJsonData,
            resolvedValues,
            namedResolver,
          );

          // Render actual template body so OMNI shows the real message text
          const renderedBody = renderWaTemplateBody(
            templateJsonData,
            resolvedValues,
            namedResolver,
          );
          const messageContent = renderedBody || `[Template: ${waTemplate?.name ?? action.wa_template_id}]`;

          // Render header text for OMNI display (with resolved variable values)
          let headerText = '';
          if (Array.isArray(templateJsonData?.components)) {
            const hComp = (templateJsonData.components as Array<Record<string, unknown>>).find(
              (c) => (c.type as string)?.toUpperCase() === 'HEADER' && (c.format as string)?.toUpperCase() === 'TEXT',
            );
            if (hComp?.text) {
              headerText = isNamedTemplate
                ? (hComp.text as string).replace(/\{\{(\w+)\}\}/g, (_, v) => namedResolver(v))
                : (hComp.text as string).replace(/\{\{(\d+)\}\}/g, (_, n) => resolvedValues[Number(n) - 1] ?? '');
            }
          }

          // Extract buttons for OMNI visual rendering
          const templateButtons: { text: string; type: string }[] = [];
          if (Array.isArray(templateJsonData?.components)) {
            const bComp = (templateJsonData.components as Array<Record<string, unknown>>).find(
              (c) => (c.type as string)?.toUpperCase() === 'BUTTONS',
            );
            if (bComp && Array.isArray(bComp.buttons)) {
              for (const btn of bComp.buttons as Array<Record<string, unknown>>) {
                templateButtons.push({ text: btn.text as string, type: btn.type as string });
              }
            }
          }

          const { error: msgErr } = await supabase.from('messages').insert({
            people_id: personId,
            lead_id: leadId ?? undefined,
            channel: 'whatsapp',
            from_contact: 'sistema',
            source_type: 'form',
            status: 'pending',
            content: messageContent,
            whatsapp_template_id: action.wa_template_id,
            wa_phone_number_id: channel.id,
            module_ref_id: submission?.id ?? undefined,
            metadata: {
              template_name: waTemplate?.name ?? '',
              language_code: ((templateJsonData?.language ?? templateJsonData?.languageCode) as string) ?? 'pt_BR',
              components: templateComponents,
              variable_map: action.wa_variable_map ?? {},
              resolved_values: resolvedValues,
              delay_minutes: action.delay_minutes ?? 0,
              ...(headerText ? { header_text: headerText } : {}),
              ...(templateButtons.length > 0 ? { buttons: templateButtons } : {}),
            },
            sent_at: new Date().toISOString(),
          });

          if (msgErr) {
            log.error('post-submit WA: messages INSERT failed', { actionId: action.id, error: msgErr.message });
          } else {
            log.info('post-submit WA: pending message created', {
              templateId: action.wa_template_id,
              templateName: waTemplate?.name,
              channelId: channel.id,
            });
            if (!action.delay_minutes) shouldTriggerDelivery = true;
          }

        } else if (action.channel === 'email' || action.channel === 'sms') {
          const to = action.channel === 'email' ? (pessoa.email ?? '') : (pessoa.whatsapp ?? '');
          if (!to) {
            log.warn(`post-submit ${action.channel}: no recipient — skip`, { actionId: action.id });
            continue;
          }

          const { error: msgErrEmail } = await supabase.from('messages').insert({
            people_id: personId,
            lead_id: leadId ?? undefined,
            channel: action.channel,
            from_contact: 'sistema',
            source_type: 'form',
            status: 'pending',
            content: action.message_template ?? '',
            module_ref_id: submission?.id ?? undefined,
            metadata: {
              webhook_id: action.webhook_id ?? null,
              subject: action.subject ?? null,
              to,
              delay_minutes: action.delay_minutes ?? 0,
            },
            sent_at: new Date().toISOString(),
          });

          if (msgErrEmail) {
            log.error(`post-submit ${action.channel}: messages INSERT failed`, { actionId: action.id, error: msgErrEmail.message });
          } else {
            log.info(`post-submit ${action.channel}: pending message created`, {
              webhookId: action.webhook_id,
            });
          }
        }
      } catch (e) {
        log.error('post-submit action error', { actionId: action.id, error: (e as Error).message });
      }
    }
  }

  // ── 12. Trigger OMNI delivery engine immediately (skip waiting for pg_cron) ──
  // Only fires when there are zero-delay pending messages to dispatch.
  // Fire-and-forget: we don't await the response — form submitter gets instant success.
  if (shouldTriggerDelivery && personId) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    fetch(`${supabaseUrl}/functions/v1/omni-delivery-engine`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ trigger: 'form', people_id: personId, channel: 'whatsapp' }),
    }).catch((e) => log.warn('delivery-engine kick failed (non-blocking)', { error: String(e) }));
    log.info('delivery-engine kicked', { personId });
  }

  // Resolve success route: route only fires when appliedMatrixId matches its matrix_ids.
  // empty matrix_ids = disabled (no scores selected = never fires → falls through to Padrão).
  let successRoute: (SuccessRoute & Record<string, unknown>) | null = null;
  if (settings.success_routes?.length) {
    successRoute = settings.success_routes.find(
      (r) => r.matrix_ids?.length > 0 && appliedMatrixId != null && r.matrix_ids.includes(appliedMatrixId)
    ) ?? null;
  }

  return new Response(
    JSON.stringify({
      success: true,
      existing: isExistingLead,
      message: isExistingLead ? 'Seu atendimento já foi iniciado.' : null,
      redirect_url: settings.redirect_url || null,
      score: appliedScore,
      score_matrix_id: appliedMatrixId,
      lead_id: leadId ?? null,
      person_id: personId ?? null,
      success_route: successRoute,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
});
