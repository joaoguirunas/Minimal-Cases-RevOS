import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createLogger } from '../_shared/logger.ts';
import { resolveTemplateBodyText } from '../_shared/evolution-outbound-lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Valida o bearer decodificando o JWT e conferindo `role === 'service_role'`.
 *
 * NUNCA comparar `bearer === SUPABASE_SERVICE_ROLE_KEY` por string: a rotação para o
 * novo sistema de API keys do Supabase quebra o string-match e o cron passa a tomar
 * 401 silencioso (memória `supabase-new-api-keys-cron-auth`).
 * Espelha ai-callback-worker/logic.ts:isServiceRoleJwt.
 */
function isServiceRoleJwt(bearer: string | null | undefined): boolean {
  if (!bearer) return false;
  const parts = bearer.split('.');
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

// Input validation schema
const SendDispatchRequestSchema = z.object({
  send_id: z.string().uuid("send_id deve ser um UUID válido"),
  batch_size: z.number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(1),
  validate_only: z.boolean().optional().default(false),
});

type SendDispatchRequest = z.infer<typeof SendDispatchRequestSchema>;

// ── Template component builder (mirrors templateUtils.ts on frontend) ─────────
// Used to render message content for display in OMNI PRO and to build
// WA template components stored in metadata for the Delivery Engine.

type PersonContext = {
  name?: string;
  email?: string;
  whatsapp?: string;
  customFields?: Record<string, string>;
};

function resolveTemplateVar(v: string, person: PersonContext | null): string {
  if (!person) return '';
  const lower = v.toLowerCase();
  const primeiroNome = (person.name || '').split(' ')[0];
  const map: Record<string, string> = {
    '1': person.name || '', '2': person.whatsapp || '', '3': person.email || '',
    'nome': person.name || '', 'name': person.name || '', 'nome_cliente': person.name || '',
    'primeiro_nome': primeiroNome, 'first_name': primeiroNome,
    'order_id': person.name || '', 'customer_name': person.name || '', 'client_name': person.name || '',
    'email': person.email || '',
    'whatsapp': person.whatsapp || '', 'telefone': person.whatsapp || '', 'phone': person.whatsapp || '',
    // Custom lead fields (populated from lead_field_values)
    ...(person.customFields ?? {}),
  };
  return map[lower] ?? '';
}

function renderTemplateBody(
  jsonData: Record<string, unknown> | null,
  person: PersonContext | null,
): string {
  if (!jsonData) return '';

  let bodyText = '';

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

  if (bodyText && person) {
    bodyText = bodyText.replace(/\{\{(\w+)\}\}/g, (_, varName) => resolveTemplateVar(varName, person));
  }

  return bodyText;
}

function buildTemplateComponents(
  jsonData: Record<string, unknown> | null,
  person: PersonContext | null,
): Array<Record<string, unknown>> {
  if (!jsonData) return [];

  // Meta API v22+ requires parameter_name for NAMED templates.
  // Always include it — Meta ignores it on POSITIONAL templates but rejects its absence on NAMED.
  const makeParam = (varName: string) => {
    const param: Record<string, string> = { type: 'text', text: resolveTemplateVar(varName, person) };
    param.parameter_name = varName;
    return param;
  };

  const extractVarNames = (text: string): string[] => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
      if (!seen.has(m[1])) { seen.add(m[1]); names.push(m[1]); }
    }
    return names;
  };

  // Standard components[] format
  if (Array.isArray(jsonData.components)) {
    const result: Array<Record<string, unknown>> = [];
    for (const component of jsonData.components as Array<Record<string, unknown>>) {
      const ctype = (component.type as string)?.toUpperCase();
      if (ctype === 'HEADER' && (component.format as string)?.toUpperCase() === 'TEXT' && typeof component.text === 'string') {
        const vars = extractVarNames(component.text);
        if (vars.length > 0) result.push({ type: 'header', parameters: vars.map(makeParam) });
      }
      if (ctype === 'BODY' && typeof component.text === 'string') {
        const vars = extractVarNames(component.text);
        if (vars.length > 0) result.push({ type: 'body', parameters: vars.map(makeParam) });
      }
      if (ctype === 'BUTTONS' && Array.isArray(component.buttons)) {
        (component.buttons as Array<Record<string, unknown>>).forEach((button, btnIndex) => {
          if (button.type === 'URL' && typeof button.url === 'string') {
            const vars = extractVarNames(button.url);
            vars.forEach(v => {
              result.push({ type: 'button', sub_type: 'url', index: String(btnIndex), parameters: [makeParam(v)] });
            });
          }
        });
      }
    }
    return result;
  }

  // Gupshup legacy containerMeta format — body only
  let containerMeta: Record<string, unknown> = {};
  try {
    if (jsonData.containerMeta) {
      containerMeta = typeof jsonData.containerMeta === 'string'
        ? JSON.parse(jsonData.containerMeta as string)
        : (jsonData.containerMeta as Record<string, unknown>);
    }
  } catch {}
  const bodyText = (containerMeta.data as string) || (jsonData.data as string) || '';
  if (!bodyText) return [];
  const vars = extractVarNames(bodyText);
  if (vars.length === 0) return [];
  return [{ type: 'body', parameters: vars.map(makeParam) }];
}

// ── Payload enrichment helpers ────────────────────────────────────────────────

const Q_FIELDS = [
  'q1_main_bottleneck', 'q2_lead_volume_month', 'q3_team_size',
  'q4_crm_maturity', 'q5_crm_name', 'q6_trigger',
  'q7_problem_impact', 'q8_engagement_level', 'q9_decision_authority',
  'q10_stakeholders', 'q11_budget_approved', 'q12_timeline',
  'q13_urgency_reason', 'q14_data_ready', 'q15_minimum_volume',
  'q16_expected_roi', 'q17_objections', 'q18_real_fit',
  'q19_qualification_status', 'q20_rejection_reason',
  'q21_interest_level', 'q22_close_probability',
  'q23_behavioral_tags', 'q24_last_update_by_agent',
  'q25_disc_profile',
] as const;

/**
 * "Mover leads após disparo" (ConfiguracaoDisparoTab.tsx) já grava pipeline_id +
 * stage_ids[0] no send há tempo, mas o backend nunca implementava o move de
 * verdade — feature morta na tela. Isso resolve: acha o lead dessa pessoa na
 * pipeline de destino e move pra etapa de destino ao enviar com sucesso.
 * Best-effort — nunca derruba o envio se a movimentação falhar.
 */
async function maybeAdvanceStage(
  // deno-lint-ignore no-explicit-any
  supabase: any, // ReturnType<typeof createClient> mismatches its own call-site type here (pre-existing quirk, see recordDeliveryAttempt in whatsapp-outbound)
  send: { pipeline_id?: string | null; stage_ids?: string[] | null },
  peopleId: string | null,
): Promise<void> {
  const targetStageId = send.stage_ids?.[0];
  if (!targetStageId || !send.pipeline_id || !peopleId) return;
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, leads_stages_id')
      .eq('people_id', peopleId)
      .eq('leads_pipelines_id', send.pipeline_id)
      .maybeSingle() as unknown as { data: { id: string; leads_stages_id: string | null } | null };
    if (!lead || lead.leads_stages_id === targetStageId) return;
    await supabase.from('leads').update({ leads_stages_id: targetStageId }).eq('id', lead.id);
  } catch (err) {
    console.warn('[sends] stage advance failed:', (err as Error).message);
  }
}

interface PayloadEnrichment {
  scores: { framing: string | null; investment: string | null; objective: string | null };
  utm: { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null };
  responsible_name: string | null;
  qualification: Record<string, string>;
  wa_channel_name?: string | null;
}

function buildEnrichment(
  person: Record<string, unknown> | null,
  leadData: { user_id: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null } | undefined,
  userNamesById: Map<string, string>,
  waChannelLabel?: string | null,
): PayloadEnrichment {
  // Scores — resolved via JOINs on clients_people
  const scoreFraming = person?.score_framing as { name?: string } | null;
  const scoreInvestment = person?.score_investment as { name?: string } | null;
  const scoreObjective = person?.score_objective as { name?: string } | null;

  // Qualification — non-null Q fields
  const qualification: Record<string, string> = {};
  if (person) {
    for (const field of Q_FIELDS) {
      const val = person[field];
      if (val != null && val !== '') {
        qualification[field] = String(val);
      }
    }
  }

  // Responsible name
  const responsibleName = leadData?.user_id
    ? userNamesById.get(leadData.user_id) ?? null
    : null;

  return {
    scores: {
      framing: scoreFraming?.name ?? null,
      investment: scoreInvestment?.name ?? null,
      objective: scoreObjective?.name ?? null,
    },
    utm: {
      utm_source: leadData?.utm_source ?? null,
      utm_medium: leadData?.utm_medium ?? null,
      utm_campaign: leadData?.utm_campaign ?? null,
      utm_content: leadData?.utm_content ?? null,
      utm_term: leadData?.utm_term ?? null,
    },
    responsible_name: responsibleName,
    qualification,
    ...(waChannelLabel !== undefined ? { wa_channel_name: waChannelLabel } : {}),
  };
}

// ── Channel dispatch helpers ──────────────────────────────────────────────────

interface ChannelCreds {
  provider: string;
  // smtp
  host?: string; port?: string; user?: string; pass?: string;
  from_email?: string; from_name?: string;
  // sendgrid
  api_key?: string;
  // twilio (sms + phone)
  account_sid?: string; auth_token?: string; from_number?: string;
  [key: string]: string | undefined;
}

interface WebhookFallback {
  url?: string;
  enabled?: boolean;
  payload_template?: string;
}

// sends.channel → omni_channel_configs.channel
const CHANNEL_TO_OMNI: Record<string, string> = {
  email: 'email',
  sms:   'sms',
  phone: 'telefone',
};

/** Send e-mail via SMTP using denomailer (dynamic import — avoids boot crash on Deno Deploy). */
async function sendViaSmtp(
  to: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  body: string,
  creds: ChannelCreds,
): Promise<void> {
  const { SmtpClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');
  const port = Number(creds.port) || 587;
  const client = new SmtpClient({ debug: false });
  try {
    if (port === 465) {
      await client.connectTLS({
        hostname: creds.host!,
        port,
        username: creds.user!,
        password: creds.pass!,
      });
    } else {
      await client.connect({
        hostname: creds.host!,
        port,
        username: creds.user!,
        password: creds.pass!,
      });
    }
    await client.send({
      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
      to,
      subject,
      content: body,
    });
  } finally {
    await client.close().catch(() => { /* ignore close errors */ });
  }
}

/** Send e-mail via SendGrid v3 API. */
async function sendViaSendGrid(
  to: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  body: string,
  apiKey: string,
): Promise<void> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName || fromEmail },
      subject,
      content: [{ type: 'text/plain', value: body }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`SendGrid ${res.status}: ${txt.substring(0, 200)}`);
  }
}

/** Send SMS via Twilio Messages API. */
async function sendViaTwilioSms(
  to: string,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string,
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Twilio SMS ${res.status}: ${txt.substring(0, 200)}`);
  }
}

/** Initiate outbound call via Twilio Programmable Voice. Reads message via <Say>. */
async function sendViaTwilioCall(
  to: string,
  message: string,
  accountSid: string,
  authToken: string,
  fromNumber: string,
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
  // Escape XML special chars to avoid breaking TwiML
  const safeMsg = message.replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] ?? c
  ));
  const twiml = `<Response><Say language="pt-BR" voice="Polly.Camila">${safeMsg}</Say></Response>`;
  const params = new URLSearchParams({ To: to, From: fromNumber, Twiml: twiml });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Twilio Call ${res.status}: ${txt.substring(0, 200)}`);
  }
}

/** Route a non-WhatsApp contact dispatch to the appropriate provider. */
async function dispatchNonWhatsApp(params: {
  channel: string;
  messageContent: string | null;
  sendName: string;
  sendId: string;
  peopleId: string | null;
  personName: string | null;
  personEmail: string | null;
  phoneValue: string | null;
  creds: ChannelCreds;
  webhookFallback: WebhookFallback | null;
  n8nWebhookUrl: string | null;
  enrichment?: PayloadEnrichment | null;
}): Promise<void> {
  const {
    channel, messageContent, sendName, sendId,
    peopleId, personName, personEmail, phoneValue,
    creds, webhookFallback, n8nWebhookUrl, enrichment,
  } = params;

  const provider = creds?.provider ?? 'webhook';
  const body = messageContent || `[Campanha: ${sendName}]`;

  // ── Email ──
  if (channel === 'email') {
    if (provider === 'smtp') {
      if (!personEmail) throw new Error('Contato sem e-mail cadastrado');
      if (!creds.host || !creds.user || !creds.pass) throw new Error('SMTP: host, usuário e senha são obrigatórios');
      await sendViaSmtp(
        personEmail,
        creds.from_email || creds.user,
        creds.from_name || sendName,
        sendName,
        body,
        creds,
      );
      return;
    }
    if (provider === 'sendgrid') {
      if (!personEmail) throw new Error('Contato sem e-mail cadastrado');
      if (!creds.api_key) throw new Error('SendGrid: API Key não configurada');
      if (!creds.from_email) throw new Error('SendGrid: From Email não configurado');
      await sendViaSendGrid(
        personEmail,
        creds.from_email,
        creds.from_name || sendName,
        sendName,
        body,
        creds.api_key,
      );
      return;
    }
  }

  // ── SMS ──
  if (channel === 'sms') {
    if (provider === 'twilio') {
      if (!phoneValue) throw new Error('Contato sem telefone cadastrado');
      if (!creds.account_sid || !creds.auth_token || !creds.from_number) {
        throw new Error('Twilio SMS: Account SID, Auth Token e número de origem são obrigatórios');
      }
      await sendViaTwilioSms(phoneValue, body, creds.account_sid, creds.auth_token, creds.from_number);
      return;
    }
  }

  // ── Phone (outbound call) ──
  if (channel === 'phone') {
    if (provider === 'twilio') {
      if (!phoneValue) throw new Error('Contato sem telefone cadastrado');
      if (!creds.account_sid || !creds.auth_token || !creds.from_number) {
        throw new Error('Twilio Call: Account SID, Auth Token e número de origem são obrigatórios');
      }
      await sendViaTwilioCall(phoneValue, body, creds.account_sid, creds.auth_token, creds.from_number);
      return;
    }
  }

  // ── Webhook fallback (provider='webhook' or unrecognized provider) ──
  // Priority: channel-level webhook (omni_channel_configs) > sends N8N webhook
  const effectiveWebhookUrl = webhookFallback?.url || n8nWebhookUrl;
  if (!effectiveWebhookUrl) {
    const channelLabel = channel === 'email' ? 'E-mail' : channel === 'sms' ? 'SMS' : 'Chamadas';
    throw new Error(`Canal ${channel} sem configuração de envio. Configure em Configurações → ${channelLabel}.`);
  }

  const webhookPayload = {
    send_id:         sendId,
    send_name:       sendName,
    channel,
    contact: {
      people_id:     peopleId,
      name:          personName,
      email:         personEmail,
      channel_value: channel === 'email' ? personEmail : phoneValue,
      ...(enrichment?.qualification && Object.keys(enrichment.qualification).length > 0
        ? { qualification: enrichment.qualification } : {}),
    },
    ...(enrichment ? {
      scores:           enrichment.scores,
      utm:              enrichment.utm,
      responsible_name: enrichment.responsible_name,
    } : {}),
    message_content: messageContent,
    timestamp: new Date().toISOString(),
  };

  const webhookRes = await fetch(effectiveWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
    signal: AbortSignal.timeout(30000),
  });

  if (!webhookRes.ok) {
    const txt = await webhookRes.text().catch(() => '');
    // Preserve Retry-After header for 429 handling (AC-8)
    const retryAfter = webhookRes.headers.get('Retry-After');
    const retryInfo = retryAfter ? ` Retry-After: ${retryAfter}` : '';
    throw new Error(`Webhook ${webhookRes.status}: ${txt.substring(0, 200)}${retryInfo}`);
  }
}

// ── Retry with Exponential Backoff ────────────────────────────────────────────

/** Error classification for retry decisions. */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true; // Unknown errors → retry
  const msg = error.message;

  // HTTP 4xx (except 429) → NOT retryable
  const httpMatch = msg.match(/(\d{3}):/);
  if (httpMatch) {
    const code = parseInt(httpMatch[1], 10);
    if (code === 429) return true;  // Rate limit → retryable
    if (code >= 400 && code < 500) return false; // Other 4xx → permanent failure
  }

  // Everything else (5xx, timeout, network) → retryable
  return true;
}

/** Extract Retry-After header delay in ms from error message, or return null. */
function parseRetryAfterMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/Retry-After:\s*(\d+)/i);
  if (match) return parseInt(match[1], 10) * 1000;
  return null;
}

interface RetryContext {
  sendId: string;
  peopleId: string | null;
  contactId: string;
  supabase: ReturnType<typeof createClient>;
}

/**
 * Retry a function with exponential backoff.
 * AC-2: 5s → 15s → 45s (3 attempts max after initial try)
 * AC-7: HTTP 4xx (except 429) → immediate fail
 * AC-8: HTTP 429 → respect Retry-After header or use backoff
 * AC-9: Inline retry within batch processing
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  ctx: RetryContext,
  maxRetries: number = 3,
  delays: number[] = [5000, 15000, 45000],
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Update retry_count on success (only if we actually retried)
      if (attempt > 0) {
        await ctx.supabase
          .from('sends_contacts')
          .update({ retry_count: attempt })
          .eq('id', ctx.contactId);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // AC-6: Structured log for each attempt
      console.log(JSON.stringify({
        send_id: ctx.sendId,
        people_id: ctx.peopleId,
        contact_id: ctx.contactId,
        attempt: attempt + 1,
        max_retries: maxRetries + 1,
        delay_ms: attempt < maxRetries ? (delays[attempt] ?? delays[delays.length - 1]) : 0,
        error: lastError.message.substring(0, 255),
        will_retry: attempt < maxRetries && isRetryableError(error),
      }));

      // AC-7: Non-retryable errors → fail immediately
      if (!isRetryableError(error)) {
        // Update retry_count to track how far we got
        await ctx.supabase
          .from('sends_contacts')
          .update({ retry_count: attempt })
          .eq('id', ctx.contactId);
        throw lastError;
      }

      if (attempt < maxRetries) {
        // AC-8: Use Retry-After header if present, otherwise backoff schedule
        const retryAfterMs = parseRetryAfterMs(error);
        const delay = retryAfterMs ?? delays[attempt] ?? delays[delays.length - 1];

        // Update retry_count to track progress
        await ctx.supabase
          .from('sends_contacts')
          .update({ retry_count: attempt + 1 })
          .eq('id', ctx.contactId);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // AC-3: After all retries exhausted, update final retry_count
  await ctx.supabase
    .from('sends_contacts')
    .update({ retry_count: maxRetries })
    .eq('id', ctx.contactId);

  throw lastError;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('send-dispatch-worker');
  log.info('start');

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Accept service role key (pg_cron / sends-dispatch-batch path) or user JWT.
    // Two valid shapes for "this is the service role":
    //   1. Legacy JWT com role=service_role — usado pelo pg_cron via _app_config.service_role_key
    //      (pode ficar desatualizado em relação ao env var após rotação de chaves, mas continua
    //      um JWT válido — só o isServiceRoleJwt decodifica, não compara string).
    //   2. Live env-to-env match — sends-dispatch-batch (e outras functions) chamam este worker
    //      usando o PRÓPRIO Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') como token; depois da
    //      rotação pro novo sistema de API keys esse valor virou a "secret key" (não é mais um
    //      JWT), então isServiceRoleJwt sozinho rejeita — mas como os dois lados leem a mesma
    //      env var em tempo real, a comparação por string aqui é segura (não é o caso "stale"
    //      do memory supabase-new-api-keys-cron-auth).
    const isServiceRole = isServiceRoleJwt(token) || (!!serviceRoleKey && token === serviceRoleKey);

    if (!isServiceRole) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    );

    // ── Input validation ──────────────────────────────────────────────────────
    let validatedInput: SendDispatchRequest;
    try {
      const rawBody = await req.json();
      validatedInput = SendDispatchRequestSchema.parse(rawBody);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const msg = validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return new Response(
          JSON.stringify({ success: false, error: `Validação falhou: ${msg}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw validationError;
    }

    const { send_id, batch_size, validate_only } = validatedInput;

    // ── Fetch send record ─────────────────────────────────────────────────────
    const { data: send, error: sendError } = await supabase
      .from('sends')
      .select('*')
      .eq('id', send_id)
      .single();

    if (sendError || !send) {
      throw new Error(`Disparo não encontrado: ${sendError?.message}`);
    }

    // ── Resolve dispatch method ───────────────────────────────────────────────
    const isWhatsApp = send.channel === 'whatsapp';

    // Fetch WA channel separately — avoids FK join that may not exist on older tenants
    let waChannel: Record<string, string> | null = null;
    if (isWhatsApp && send.wa_channel_id) {
      const { data: waChannelData } = await supabase
        .from('settings_whatsapp_channels')
        .select('id, phone_number_id, access_token, label, provider, evolution_base_url, evolution_api_key, evolution_instance_name')
        .eq('id', send.wa_channel_id)
        .maybeSingle();
      waChannel = waChannelData as Record<string, string> | null;
    }

    // Fetch WhatsApp template data separately (no FK join available)
    let waTemplate: { id_template: string; name: string; meta_template_name: string | null; json_data: Record<string, unknown> } | null = null;
    if (isWhatsApp && send.template_id) {
      const { data: tmpl } = await supabase
        .from('whatsapp_templates')
        .select('id_template, name, meta_template_name, json_data')
        .eq('id', send.template_id)
        .maybeSingle();
      waTemplate = tmpl ?? null;
    }

    // ── Fetch omni channel config for non-WA channels ─────────────────────────
    let channelCreds: ChannelCreds = { provider: 'webhook' };
    let channelWebhookFallback: WebhookFallback | null = null;

    if (!isWhatsApp) {
      const omniKey = CHANNEL_TO_OMNI[send.channel];
      if (omniKey) {
        const { data: omniConfig } = await supabase
          .from('omni_channel_configs')
          .select('credentials, webhook_fallback')
          .eq('channel', omniKey)
          .maybeSingle();

        if (omniConfig?.credentials) {
          channelCreds = omniConfig.credentials as ChannelCreds;
        }
        if (omniConfig?.webhook_fallback) {
          channelWebhookFallback = omniConfig.webhook_fallback as WebhookFallback;
        }
      }
    }

    // Validate required config
    if (isWhatsApp && !waChannel) {
      throw new Error('Canal WhatsApp não configurado para este disparo. Selecione um número em Configurações → WhatsApp.');
    }

    if (!isWhatsApp) {
      const isDirectProvider = channelCreds.provider !== 'webhook';
      const hasWebhook = !!(send.webhook?.url || channelWebhookFallback?.url);
      if (!isDirectProvider && !hasWebhook) {
        const channelLabel = send.channel === 'email' ? 'E-mail' : send.channel === 'sms' ? 'SMS' : 'Chamadas';
        throw new Error(`Canal ${send.channel} sem configuração de envio. Configure em Configurações → ${channelLabel}.`);
      }
    }

    // ── Validate only mode ────────────────────────────────────────────────────
    if (validate_only) {
      if (isWhatsApp) {
        const waChannelObj = waChannel as Record<string, string> | null;
        const isValid = waChannelObj?.provider === 'evolution'
          ? !!(waChannelObj?.evolution_base_url && waChannelObj?.evolution_api_key && waChannelObj?.evolution_instance_name)
          : !!(waChannelObj?.phone_number_id && waChannelObj?.access_token);
        return new Response(
          JSON.stringify({
            success: isValid,
            message: isValid ? 'Canal WhatsApp validado' : 'Canal WhatsApp inválido ou sem credenciais',
            validated: isValid,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Non-WA: validate by provider
      if (channelCreds.provider === 'smtp') {
        const ok = !!(channelCreds.host && channelCreds.user && channelCreds.pass && channelCreds.from_email);
        return new Response(
          JSON.stringify({ success: ok, message: ok ? 'SMTP configurado' : 'SMTP: host, usuário, senha e from_email são obrigatórios', validated: ok }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (channelCreds.provider === 'sendgrid') {
        const ok = !!(channelCreds.api_key && channelCreds.from_email);
        return new Response(
          JSON.stringify({ success: ok, message: ok ? 'SendGrid configurado' : 'SendGrid: API Key e From Email são obrigatórios', validated: ok }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (channelCreds.provider === 'twilio') {
        const ok = !!(channelCreds.account_sid && channelCreds.auth_token && channelCreds.from_number);
        return new Response(
          JSON.stringify({ success: ok, message: ok ? 'Twilio configurado' : 'Twilio: Account SID, Auth Token e número são obrigatórios', validated: ok }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Webhook validation — test the URL
      const webhookUrl = channelWebhookFallback?.url || send.webhook?.url;
      if (!webhookUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhuma configuração de envio encontrada', validated: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      try {
        const testRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, send_id }),
          signal: AbortSignal.timeout(10000),
        });
        if (!testRes.ok) throw new Error(`Webhook retornou status ${testRes.status}`);
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook validado', validated: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        const msg = (err as Error).message;
        return new Response(
          JSON.stringify({ success: false, error: `Webhook inválido: ${msg}`, validated: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Fetch pending contacts ─────────────────────────────────────────────────
    // Also picks up 'sending' rows whose claim is stale (>5min) — a worker that
    // crashed or timed out mid-send would otherwise leave that contact stuck
    // forever, never retried, never counted as failed.
    const STALE_CLAIM_CUTOFF = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: contacts, error: contactsError } = await supabase
      .from('sends_contacts')
      .select(`
        id, people_id, whatsapp,
        person:clients_people(
          id, name, email
        )
      `)
      .eq('send_id', send_id)
      .or(`status.eq.pending,and(status.eq.sending,claimed_at.lt.${STALE_CLAIM_CUTOFF})`)
      .order('created_at', { ascending: true })
      .limit(batch_size);

    if (contactsError) throw new Error(`Erro ao buscar contatos: ${contactsError.message}`);

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum contato pendente', processed: 0, has_more: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Atomic claim ─────────────────────────────────────────────────────────
    // FIX-SENDS-DUP-01: the SELECT above is not exclusive — two overlapping
    // invocations (a slow-running cron tick still in flight when the next
    // minute's tick fires, or a manual trigger racing the cron) could both
    // fetch the same 'pending' rows and both actually send the WhatsApp
    // message, since nothing marked the row as claimed before the real send.
    // This UPDATE...WHERE status IN (pending, stale-sending) is atomic at the
    // DB row level — only the invocation that flips the row to 'sending' with
    // ITS OWN claimed_at may process it; a losing concurrent invocation gets
    // zero rows back for it (the WHERE no longer matches once the winner commits).
    const candidateIds = contacts.map((c) => c.id);
    const { data: claimedRows, error: claimError } = await supabase
      .from('sends_contacts')
      .update({ status: 'sending', claimed_at: new Date().toISOString() })
      .in('id', candidateIds)
      .or(`status.eq.pending,and(status.eq.sending,claimed_at.lt.${STALE_CLAIM_CUTOFF})`)
      .select('id');
    if (claimError) throw new Error(`Erro ao reivindicar contatos: ${claimError.message}`);
    const claimedIds = new Set((claimedRows ?? []).map((r: { id: string }) => r.id));
    const claimedContacts = contacts.filter((c) => claimedIds.has(c.id));
    if (claimedContacts.length < contacts.length) {
      console.warn(`[sends] claim race: ${contacts.length - claimedContacts.length} contact(s) already claimed by a concurrent run, skipping`);
    }
    contacts.length = 0;
    contacts.push(...claimedContacts);
    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Todos os contatos já foram reivindicados por outra execução', processed: 0, has_more: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Enrich: resolve leads (UTM + responsible) in batch ──────────────────
    type LeadEnrichment = {
      lead_id: string;
      user_id: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_content: string | null;
      utm_term: string | null;
      recomendante: string | null;
      relacao_recomendante: string | null;
      relacao_corretor: string | null;
      nome_evento: string | null;
    };
    const leadsByPeopleId = new Map<string, LeadEnrichment>();
    const userNamesById = new Map<string, string>();

    // Native lead columns added by migration 20260502130000 — may be absent on
    // tenants where the migration has not been applied yet. Queried defensively
    // (separate try/catch) so a missing-column error does not poison the whole
    // enrichment path (UTM, responsible_name, scores).
    const NATIVE_LEAD_COLS = ['recomendante', 'relacao_recomendante', 'relacao_corretor', 'nome_evento'] as const;

    try {
      const peopleIds = contacts
        .map(c => c.people_id)
        .filter((id): id is string => !!id);

      if (peopleIds.length > 0) {
        // Resolve leads — filter by pipeline if available
        const pipelineId = (send.filter_config as Record<string, unknown> | null)?.pipeline_id as string | undefined;

        // Step A: core enrichment (always-present columns) — keep this resilient
        let leadsQuery = supabase
          .from('leads')
          .select('id, people_id, user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at')
          .in('people_id', peopleIds)
          .order('created_at', { ascending: false });

        if (pipelineId) {
          leadsQuery = leadsQuery.eq('leads_pipelines_id', pipelineId);
        }

        const { data: leadsData } = await leadsQuery;
        if (leadsData) {
          // DISTINCT ON people_id — keep only the most recent lead per person
          for (const lead of leadsData) {
            if (lead.people_id && !leadsByPeopleId.has(lead.people_id)) {
              leadsByPeopleId.set(lead.people_id, {
                lead_id: lead.id,
                user_id: lead.user_id,
                utm_source: lead.utm_source,
                utm_medium: lead.utm_medium,
                utm_campaign: lead.utm_campaign,
                utm_content: lead.utm_content,
                utm_term: lead.utm_term,
                recomendante: null,
                relacao_recomendante: null,
                relacao_corretor: null,
                nome_evento: null,
              });
            }
          }
        }

        // Step B: native indication/event columns — defensive query, isolated failure
        const leadIds = [...leadsByPeopleId.values()].map(l => l.lead_id);
        if (leadIds.length > 0) {
          try {
            const { data: nativeData, error: nativeErr } = await supabase
              .from('leads')
              .select(`id, ${NATIVE_LEAD_COLS.join(', ')}`)
              .in('id', leadIds);

            if (nativeErr) {
              console.warn('⚠️ Native lead columns unavailable (migration not applied?):', nativeErr.message);
            } else if (nativeData) {
              const nativeById = new Map<string, Record<string, unknown>>();
              for (const row of nativeData as Array<Record<string, unknown>>) {
                if (row.id) nativeById.set(row.id as string, row);
              }
              for (const enrichment of leadsByPeopleId.values()) {
                const row = nativeById.get(enrichment.lead_id);
                if (!row) continue;
                for (const col of NATIVE_LEAD_COLS) {
                  const v = row[col];
                  if (typeof v === 'string' && v !== '') {
                    enrichment[col] = v;
                  }
                }
              }
            }
          } catch (nativeCatchErr) {
            console.warn('⚠️ Native lead column fetch threw (continuing without):', (nativeCatchErr as Error).message);
          }
        }

        // Resolve user names for responsible
        const userIds = [...new Set(
          [...leadsByPeopleId.values()]
            .map(l => l.user_id)
            .filter((id): id is string => !!id),
        )];
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('settings_users')
            .select('id, name')
            .in('id', userIds);
          if (usersData) {
            for (const u of usersData) {
              userNamesById.set(u.id, u.name);
            }
          }
        }
      }
    } catch (enrichErr) {
      console.error('⚠️ Lead enrichment query failed (continuing with base data):', (enrichErr as Error).message);
    }

    const templateLang: string = (waTemplate?.json_data?.languageCode as string) ?? 'pt_BR';

    // ── Process batch ─────────────────────────────────────────────────────────
    let successCount = 0;
    let errorCount = 0;

    for (const contact of contacts) {
      const person = (contact as Record<string, unknown>).person as Record<string, unknown> | null;

      try {
        if (isWhatsApp) {
          // ── Queue via Delivery Engine ──────────────────────────────────────
          // Insert message as 'pending' — omni-delivery-engine picks it up via
          // pg_cron and routes through whatsapp-outbound → Meta Graph API.
          const waChannelObj = waChannel as Record<string, string>;
          const phone = (contact as Record<string, unknown>).whatsapp as string | null;
          if (!phone) throw new Error('Contato sem número WhatsApp');
          if (!waTemplate) throw new Error('Template WhatsApp não definido');

          // Evolution não registra template na Meta — texto livre, só precisa existir
          // corpo BODY no template. Meta precisa do nome registrado (meta_template_name).
          const resolvedTemplateName = waTemplate.meta_template_name
            || (waTemplate.json_data?.elementName as string)
            || '';
          if (waChannelObj.provider === 'evolution') {
            const components = (waTemplate.json_data?.components as Array<{ type: string; text?: string }>) ?? [];
            if (!resolveTemplateBodyText(components)) {
              throw new Error(
                `Template "${waTemplate.name}" (id_template: ${waTemplate.id_template}) sem corpo BODY — preencha o texto do template`,
              );
            }
          } else if (!resolvedTemplateName) {
            throw new Error(
              `Template "${waTemplate.name}" (id_template: ${waTemplate.id_template}) sem meta_template_name — preencha o campo no cadastro de templates`,
            );
          }

          if (!contact.people_id) throw new Error('Contato sem people_id');

          // Lock anti-duplicidade GLOBAL: uma vez que um lead recebe QUALQUER disparo nosso
          // (qualquer campanha, qualquer template), ele fica marcado e nunca recebe outro.
          // Checa em sends_contacts (histórico de TODAS as campanhas Sends PRO), não só a atual,
          // e não só o mesmo template — isso é intencional: "disparo nosso" = qualquer campanha
          // de broadcast, não fica restrito à campanha/template presente. Conversas orgânicas
          // iniciadas pelo agente de IA para outros produtos (iniciar_conversa_whatsapp) não usam
          // sends_contacts, então não são afetadas por este lock.
          if (contact.people_id) {
            const { data: alreadyDispatched } = await supabase
              .from('sends_contacts')
              .select('id, send_id, sent_at')
              .eq('people_id', contact.people_id)
              .neq('id', contact.id)
              .in('status', ['sent', 'delivered', 'read'])
              .limit(1)
              .maybeSingle();
            if (alreadyDispatched) {
              // status='error' (não existe 'skipped' no check constraint de sends_contacts) —
              // a mensagem deixa claro que não é uma falha real, é o lock de duplicidade agindo.
              await supabase
                .from('sends_contacts')
                .update({ status: 'error', error_message: `Bloqueado pelo lock anti-duplicidade — lead já recebeu um disparo nosso antes (sends_contacts ${alreadyDispatched.id}, send ${alreadyDispatched.send_id})` })
                .eq('id', contact.id);
              console.warn(`[sends] duplicate-send blocked (global lock): people_id=${contact.people_id} prior_sends_contacts_id=${alreadyDispatched.id}`);
              continue;
            }

            // Last-resort idempotency net, right before the real WhatsApp API call: even
            // with the atomic claim above, refuse to send if a message to THIS exact
            // people_id with THIS exact template was already recorded in the last 2
            // minutes. Catches any future bug that reaches this point through a path the
            // claim doesn't cover (e.g. a manual re-trigger, a retry outside this worker).
            if (send.template_id) {
              const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
              const { data: veryRecent } = await supabase
                .from('messages')
                .select('id')
                .eq('people_id', contact.people_id)
                .eq('whatsapp_template_id', send.template_id)
                .gte('created_at', twoMinAgo)
                .limit(1)
                .maybeSingle();
              if (veryRecent) {
                await supabase
                  .from('sends_contacts')
                  .update({ status: 'error', error_message: `Bloqueado pelo lock anti-duplicidade — mensagem idêntica já registrada nos últimos 2min (message ${veryRecent.id})` })
                  .eq('id', contact.id);
                console.warn(`[sends] duplicate-send blocked (last-resort net): people_id=${contact.people_id} recent_message_id=${veryRecent.id}`);
                continue;
              }
            }
          }

          // Fetch lead custom fields for variable resolution (e.g. recomendante, nome_evento)
          // Order: native lead columns FIRST, then lead_field_values (which override if both exist).
          // This preserves legacy behavior for tenants that defined custom fields in lead_field_values
          // before the native columns existed (migration 20260502130000).
          const customFields: Record<string, string> = {};
          const leadEnrichment = leadsByPeopleId.get(contact.people_id);

          // Step 1: native lead columns (recomendante, relacao_recomendante, etc.)
          if (leadEnrichment) {
            for (const col of NATIVE_LEAD_COLS) {
              const val = leadEnrichment[col];
              if (typeof val === 'string' && val !== '') customFields[col] = val;
            }
          }

          // Step 2: lead_field_values (overrides native if same key)
          if (leadEnrichment?.lead_id) {
            try {
              const { data: fieldValues, error: fvErr } = await supabase
                .from('lead_field_values')
                .select('value_text, lead_field_definitions!inner(key)')
                .eq('lead_id', leadEnrichment.lead_id)
                .not('value_text', 'is', null);
              if (fvErr) {
                console.warn(`⚠️ lead_field_values fetch failed for lead ${leadEnrichment.lead_id}:`, fvErr.message);
              } else if (fieldValues) {
                for (const fv of fieldValues as Array<{ value_text: string; lead_field_definitions: { key: string } }>) {
                  if (fv.lead_field_definitions?.key && fv.value_text) {
                    customFields[fv.lead_field_definitions.key.toLowerCase()] = fv.value_text;
                  }
                }
              }
            } catch (fvCatchErr) {
              console.warn(`⚠️ lead_field_values fetch threw for lead ${leadEnrichment.lead_id}:`, (fvCatchErr as Error).message);
            }
          }

          // Map positional {{1}} {{2}} {{3}} to named custom fields using template's variables_map
          // e.g. variables_map: {"1":"nome","2":"recomendante","3":"relacao_recomendante"}
          // Always set customFields[pos] when variables_map covers that position — even when empty.
          // Without this, positions not in customFields fall back to hardcoded defaults in
          // resolveTemplateVar (e.g. '2' → person.whatsapp), leaking phone numbers into template text.
          const variablesMap = (waTemplate.json_data as Record<string, unknown> | null)?.variables_map as Record<string, string> | undefined;
          if (variablesMap) {
            for (const [pos, fieldKey] of Object.entries(variablesMap)) {
              const fk = fieldKey.toLowerCase();
              const personName = person?.name as string || '';
              const val = fk === 'nome' || fk === 'name' || fk === 'nome_cliente'
                ? personName
                : fk === 'primeiro_nome' || fk === 'first_name'
                  ? personName.split(' ')[0]
                  : (customFields[fk] || '');
              customFields[pos] = val;
            }
          }

          const personForRender = person
            ? { name: person.name as string, email: person.email as string, whatsapp: phone, customFields }
            : null;
          const renderedBody = renderTemplateBody(waTemplate.json_data, personForRender);
          const components = buildTemplateComponents(waTemplate.json_data, personForRender);

          // Build enrichment data (graceful — never blocks send)
          let enrichmentData: Partial<PayloadEnrichment> = {};
          try {
            const leadData = contact.people_id ? leadsByPeopleId.get(contact.people_id) : undefined;
            const waLabel = (waChannel as Record<string, string> | null)?.label ?? null;
            enrichmentData = buildEnrichment(person, leadData, userNamesById, waLabel);
          } catch (e) {
            console.error('⚠️ WA enrichment build failed (continuing):', (e as Error).message);
          }

          const { error: msgErr } = await supabase.from('messages').insert({
            people_id:            contact.people_id,
            lead_id:              leadEnrichment?.lead_id ?? null,
            content:              renderedBody || `[Template: ${waTemplate.name ?? send.name}]`,
            channel:              'whatsapp',
            from_contact:         'sistema',
            status:               'pending',
            source_type:          'campaign',
            module_ref_id:        send_id,
            whatsapp_template_id: send.template_id ?? undefined,
            // Guarda o id (uuid) do canal, não phone_number_id — funciona pros dois
            // providers e é o que omni-delivery-engine encaminha como channel_id
            // explícito (escolha do admin por campanha, tem prioridade máxima).
            wa_phone_number_id:   waChannelObj.id,
            metadata: {
              send_id,
              send_name:     send.name,
              template_name: resolvedTemplateName,
              language_code: templateLang,
              components,
              ...enrichmentData,
            },
          });
          if (msgErr) throw new Error(`messages INSERT failed: ${msgErr.message}`);

          // Trigger immediate delivery — fire-and-forget; cron is the fallback.
          // claim_pending_messages uses FOR UPDATE SKIP LOCKED, so no race vs cron.
          const supabaseUrlForTrigger = Deno.env.get('SUPABASE_URL') ?? '';
          fetch(`${supabaseUrlForTrigger}/functions/v1/omni-delivery-engine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ people_id: contact.people_id, channel: 'whatsapp' }),
          }).catch(err => console.warn('[sends] immediate delivery trigger failed:', (err as Error).message));

          // Bump contact's updated_at so they surface in the Omni inbox
          if (contact.people_id) {
            supabase
              .from('clients_people')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', contact.people_id)
              .then(({ error: upErr }) => {
                if (upErr) console.warn('[sends] clients_people.updated_at bump failed:', upErr.message);
              });
          }

          await supabase
            .from('sends_contacts')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', contact.id);

          await maybeAdvanceStage(supabase, send, contact.people_id ?? null);

          successCount++;
          console.log(`✅ WA queued for delivery engine (people_id: ${contact.people_id})`);

        } else {
          // ── Channel-aware dispatch (Email / SMS / Phone) with retry ────────
          const phoneValue = (contact as Record<string, unknown>).whatsapp as string | null;

          // Build enrichment for webhook fallback path (graceful)
          let nonWaEnrichment: PayloadEnrichment | null = null;
          try {
            const leadData = contact.people_id ? leadsByPeopleId.get(contact.people_id) : undefined;
            nonWaEnrichment = buildEnrichment(person, leadData, userNamesById);
          } catch (e) {
            console.error('⚠️ Non-WA enrichment build failed (continuing):', (e as Error).message);
          }

          const retryCtx: RetryContext = {
            sendId: send_id,
            peopleId: contact.people_id ?? null,
            contactId: contact.id,
            supabase,
          };

          // AC-1/AC-9: Inline retry with exponential backoff for dispatch failures
          await retryWithBackoff(
            () => dispatchNonWhatsApp({
              channel:         send.channel,
              messageContent:  send.message_content ?? null,
              sendName:        send.name,
              sendId:          send_id,
              peopleId:        contact.people_id ?? null,
              personName:      (person?.name as string) ?? null,
              personEmail:     (person?.email as string) ?? null,
              phoneValue,
              creds:           channelCreds,
              webhookFallback: channelWebhookFallback,
              n8nWebhookUrl:   send.webhook?.url ?? null,
              enrichment:      nonWaEnrichment,
            }),
            retryCtx,
          );

          await supabase
            .from('sends_contacts')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', contact.id);

          await maybeAdvanceStage(supabase, send, contact.people_id ?? null);

          // Record in messages table so it appears in OMNI PRO
          if (contact.people_id) {
            const nonWaLeadId = leadsByPeopleId.get(contact.people_id)?.lead_id ?? null;
            const { error: msgErr } = await supabase.from('messages').insert({
              people_id:     contact.people_id,
              lead_id:       nonWaLeadId,
              content:       send.message_content || `[Campaign: ${send.name}]`,
              channel:       send.channel,
              from_contact:  'sistema',
              status:        'sent',
              source_type:   'campaign',
              module_ref_id: send_id,
              sent_at:       new Date().toISOString(),
              metadata:      { send_id, send_name: send.name },
            });
            if (msgErr) console.error(`messages INSERT failed for contact ${contact.people_id}:`, msgErr.message);

            // Bump contact's updated_at so they surface in the Omni inbox
            supabase
              .from('clients_people')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', contact.people_id)
              .then(({ error: upErr }) => {
                if (upErr) console.warn('[sends] clients_people.updated_at bump failed:', upErr.message);
              });
          }

          successCount++;
          console.log(`✅ ${send.channel} dispatched via ${channelCreds.provider} (people_id: ${contact.people_id})`);
        }

      } catch (err) {
        errorCount++;
        const baseMessage = err instanceof Error ? err.message : 'Erro desconhecido';

        // AC-3: Include retry count in error_message for failed contacts
        // retry_count is already updated by retryWithBackoff; read it back
        const { data: contactState } = await supabase
          .from('sends_contacts')
          .select('retry_count')
          .eq('id', contact.id)
          .single();
        const retries = (contactState as Record<string, unknown>)?.retry_count ?? 0;
        const errorMessage = `${baseMessage} [${retries} retries]`.substring(0, 255);
        console.error(`❌ Error for contact ${contact.people_id}:`, errorMessage);

        await supabase
          .from('sends_contacts')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', contact.id);

        // Atomic increment for failed_count
        const { error: incFailErr } = await supabase.rpc('increment_field', {
          table_name: 'sends', field_name: 'failed_count', row_id: send_id, increment_by: 1,
        });
        if (incFailErr) {
          await supabase.from('sends')
            .update({ failed_count: (send.failed_count || 0) + 1 })
            .eq('id', send_id);
        }
      }
    }

    // ── Update sent_count (atomic) ────────────────────────────────────────────
    if (successCount > 0) {
      const { error: incSentErr } = await supabase.rpc('increment_field', {
        table_name: 'sends', field_name: 'sent_count', row_id: send_id, increment_by: successCount,
      });
      if (incSentErr) {
        await supabase.from('sends')
          .update({ sent_count: (send.sent_count || 0) + successCount })
          .eq('id', send_id);
      }
    }

    // ── Check remaining ───────────────────────────────────────────────────────
    const { count: remainingCount } = await supabase
      .from('sends_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('send_id', send_id)
      .eq('status', 'pending');

    const hasMore = (remainingCount || 0) > 0;

    if (!hasMore) {
      await supabase
        .from('sends')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', send_id)
        .neq('status', 'completed');

      console.log('🎉 Disparo finalizado — todos os contatos processados');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: hasMore ? 'Lote processado' : 'Disparo finalizado',
        processed: successCount,
        failed: errorCount,
        total: contacts.length,
        has_more: hasMore,
        remaining: remainingCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ send-dispatch-worker error:', errMsg, error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
