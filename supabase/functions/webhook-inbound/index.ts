/**
 * Webhook Inbound — Generic External Payload Receiver
 *
 * POST /functions/v1/webhook-inbound
 * Auth: ?token={uuid} OR header X-Webhook-Token: {uuid}
 *
 * Flow:
 *   1. OPTIONS → CORS handshake
 *   2. Resolve token (query > header) → SELECT inbound_webhooks WHERE token = ? AND active = true
 *   3. Parse JSON body
 *   4. Apply field_mapping (array of {source_key, crm_field, label}) → flat crmData
 *   5. Bifurcate flow by create_mode:
 *        - criar / criar_se_nao_existir → processCrmData (full pipeline)
 *        - atualizar_etapa / somente_etapa → upsert person + updateLeadStage only
 *   6. If trigger_config.enabled → enqueue WhatsApp message (best-effort, never blocks)
 *   7. Log to webhook_logs and respond
 *
 * field_mapping shape:
 *   [{ source_key: "email", crm_field: "pessoa.email", label: "Email" }, ...]
 *
 * Reuses _shared/crm-mapper.ts and _shared/wa-template-render.ts.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  processCrmData,
  parseCrmBuckets,
  upsertPerson,
  upsertCompany,
} from '../_shared/crm-mapper.ts';
import {
  buildTemplateComponents,
  renderWaTemplateBody,
  renderWaTemplateHeader,
  extractTemplateButtons,
} from '../_shared/wa-template-render.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FieldMapping {
  source_key: string;
  crm_field: string;
  label?: string;
}

type CreateMode = 'criar' | 'criar_se_nao_existir' | 'atualizar_etapa' | 'somente_etapa';

interface TriggerConfig {
  enabled: boolean;
  channel: 'whatsapp';
  wa_channel_id: string;
  wa_template_id: string;
  wa_variable_map: Record<string, string>;
  delay_minutes: number;
}

interface InboundWebhook {
  id: string;
  name: string;
  token: string;
  pipeline_id: string | null;
  stage_id: string | null;
  field_mapping: FieldMapping[] | null;
  create_mode: CreateMode | null;
  trigger_config: TriggerConfig | null;
  active: boolean;
}

type SupabaseClient = ReturnType<typeof createClient>;
type Logger = ReturnType<typeof createLogger>;

const VALID_MODES: ReadonlyArray<CreateMode> = [
  'criar',
  'criar_se_nao_existir',
  'atualizar_etapa',
  'somente_etapa',
];

function normalizeCreateMode(raw: unknown): CreateMode {
  if (typeof raw === 'string' && (VALID_MODES as ReadonlyArray<string>).includes(raw)) {
    return raw as CreateMode;
  }
  return 'criar_se_nao_existir';
}

/**
 * Extract a value from a possibly nested payload using dot-notation paths.
 * Supports "user.email" → payload.user.email. Falls back to flat key lookup.
 */
function extractValue(payload: Record<string, unknown>, sourceKey: string): string | null {
  if (!sourceKey) return null;

  if (sourceKey in payload) {
    const v = payload[sourceKey];
    return v === null || v === undefined ? null : String(v);
  }

  if (sourceKey.includes('.')) {
    const parts = sourceKey.split('.');
    let cur: unknown = payload;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return null;
      }
    }
    return cur === null || cur === undefined ? null : String(cur);
  }

  return null;
}

/**
 * Update the stage of an existing lead for (personId, pipelineId).
 * Returns the lead id if a lead was found and updated; null otherwise.
 */
async function updateLeadStage(
  supabase: SupabaseClient,
  args: { personId: string; pipelineId: string; stageId: string },
): Promise<string | null> {
  const { personId, pipelineId, stageId } = args;
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('people_id', personId)
    .eq('leads_pipelines_id', pipelineId)
    .maybeSingle();

  if (!existing?.id) return null;

  await supabase
    .from('leads')
    .update({ leads_stages_id: stageId })
    .eq('id', existing.id);

  return existing.id;
}

/**
 * Best-effort WhatsApp dispatch driven by webhook.trigger_config.
 * Mirrors the dispatch flow in lp-submit/index.ts ~lines 1099-1240.
 * Never throws — returns true if a `messages` row was enqueued.
 */
async function maybeDispatchTrigger(
  supabase: SupabaseClient,
  wh: InboundWebhook,
  crmData: Record<string, string>,
  personId: string | null,
  leadId: string | null,
  log: Logger,
): Promise<boolean> {
  const cfg = wh.trigger_config;
  if (!cfg?.enabled) return false;

  if (!personId) {
    log.warn('webhook_trigger.no_person', { webhook_id: wh.id });
    return false;
  }

  const whatsapp =
    crmData['pessoa.whatsapp'] ||
    crmData['pessoa.telefone'] ||
    crmData['whatsapp'] ||
    crmData['telefone'] ||
    '';

  if (!whatsapp) {
    log.warn('webhook_trigger.no_whatsapp', { webhook_id: wh.id });
    return false;
  }

  if (!cfg.wa_channel_id || !cfg.wa_template_id) {
    log.warn('webhook_trigger.missing_config', { webhook_id: wh.id });
    return false;
  }

  try {
    // Só confirma que o canal existe e está ativo — não exige phone_number_id
    // (coluna Meta-only, sempre null pra canais Evolution). `wa_phone_number_id`
    // abaixo grava o id do canal, que whatsapp-outbound resolve pros dois
    // providers via `.or(phone_number_id.eq.X,id.eq.X)`.
    const { data: channel } = await supabase
      .from('settings_whatsapp_channels')
      .select('id')
      .eq('id', cfg.wa_channel_id)
      .eq('active', true)
      .maybeSingle();

    if (!channel) {
      log.warn('webhook_trigger.channel_not_found', {
        webhook_id: wh.id,
        channel_id: cfg.wa_channel_id,
      });
      return false;
    }

    const { data: waTemplate } = await supabase
      .from('whatsapp_templates')
      .select('name, json_data')
      .eq('id', cfg.wa_template_id)
      .maybeSingle();

    if (!waTemplate) {
      log.warn('webhook_trigger.template_not_found', {
        webhook_id: wh.id,
        template_id: cfg.wa_template_id,
      });
      return false;
    }

    const templateJsonData = (waTemplate.json_data as Record<string, unknown> | null) ?? null;

    // Build resolver helpers — webhook V1 has no variable_map editor, so smart defaults only.
    const { pessoa } = parseCrmBuckets(crmData);
    const NAMED_SMART_DEFAULTS: Record<string, string> = {
      nome: pessoa.nome ?? '',
      name: pessoa.nome ?? '',
      email: pessoa.email ?? '',
      telefone: pessoa.whatsapp ?? '',
      phone: pessoa.whatsapp ?? '',
      whatsapp: pessoa.whatsapp ?? '',
    };

    const variableMap = cfg.wa_variable_map ?? {};

    const resolveExplicit = (spec: string): string => {
      if (!spec) return '';
      if (spec.startsWith('fixed:')) return spec.slice(6);
      if (spec.startsWith('field:')) {
        const ref = spec.slice(6);
        return crmData[ref] ?? '';
      }
      return '';
    };

    const namedResolver = (varName: string): string => {
      const explicitSpec = variableMap[varName];
      if (explicitSpec) {
        return resolveExplicit(explicitSpec) || NAMED_SMART_DEFAULTS[varName.toLowerCase()] || ' ';
      }
      return NAMED_SMART_DEFAULTS[varName.toLowerCase()] || ' ';
    };

    // Positional values (used only for POSITIONAL templates)
    const positionalKeys = Object.keys(variableMap)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    const resolvedValues: string[] = positionalKeys.map((k) => resolveExplicit(variableMap[k]) || ' ');

    const templateComponents = buildTemplateComponents(templateJsonData, resolvedValues, namedResolver);
    const renderedBody = renderWaTemplateBody(templateJsonData, resolvedValues, namedResolver);
    const messageContent = renderedBody || `[Template: ${waTemplate.name ?? cfg.wa_template_id}]`;
    const headerText = renderWaTemplateHeader(templateJsonData, resolvedValues, namedResolver);
    const templateButtons = extractTemplateButtons(templateJsonData);

    const delayMinutes = Number.isFinite(Number(cfg.delay_minutes)) ? Number(cfg.delay_minutes) : 0;

    const { data: inserted, error: msgErr } = await supabase
      .from('messages')
      .insert({
        people_id: personId,
        lead_id: leadId ?? undefined,
        channel: 'whatsapp',
        from_contact: 'sistema',
        // 'form' matches messages_source_type_check; webhook origin is discriminated by module_ref_id pointing to inbound_webhooks.
        source_type: 'form',
        status: 'pending',
        content: messageContent,
        whatsapp_template_id: cfg.wa_template_id,
        wa_phone_number_id: channel.id,
        module_ref_id: wh.id,
        metadata: {
          template_name: waTemplate.name ?? '',
          language_code: ((templateJsonData?.language ?? templateJsonData?.languageCode) as string) ?? 'pt_BR',
          components: templateComponents,
          variable_map: variableMap,
          resolved_values: resolvedValues,
          delay_minutes: delayMinutes,
          ...(headerText ? { header_text: headerText } : {}),
          ...(templateButtons.length > 0 ? { buttons: templateButtons } : {}),
        },
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (msgErr) {
      log.error('webhook_trigger.insert_failed', {
        webhook_id: wh.id,
        error: msgErr.message,
      });
      return false;
    }

    log.info('trigger_dispatched', {
      webhook_id: wh.id,
      person_id: personId,
      message_id: inserted?.id ?? null,
      template_id: cfg.wa_template_id,
      delay_minutes: delayMinutes,
    });

    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('webhook_trigger.dispatch_error', { webhook_id: wh.id, error: msg });
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  const log = createLogger('webhook-inbound');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ── 1. Resolve token ────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const token =
    url.searchParams.get('token') ||
    req.headers.get('x-webhook-token') ||
    req.headers.get('X-Webhook-Token') ||
    '';

  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing token (query ?token= or header X-Webhook-Token)' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  // ── 2. Lookup webhook config ───────────────────────────────────────────────
  const { data: webhook, error: whErr } = await supabase
    .from('inbound_webhooks')
    .select('id, name, token, pipeline_id, stage_id, field_mapping, create_mode, trigger_config, active')
    .eq('token', token)
    .eq('active', true)
    .maybeSingle();

  if (whErr || !webhook) {
    log.warn('webhook_lookup_failed', { error: whErr?.message ?? 'not found' });
    return new Response(
      JSON.stringify({ success: false, error: 'Webhook not found or inactive' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  const wh = webhook as unknown as InboundWebhook;
  const mode = normalizeCreateMode(wh.create_mode);
  log.info('webhook_resolved', { webhook_id: wh.id, name: wh.name, create_mode: mode });

  // ── 3. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Body must be a JSON object');
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid JSON body';
    await supabase.from('webhook_logs').insert({
      webhook_id: null,
      request_body: { _inbound_webhook_id: wh.id, _raw: null },
      response_body: { success: false, error: errorMessage },
      status_code: 400,
      error_message: errorMessage,
    }).then(() => null).catch(() => null);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  // ── 3b. Validate stage_id for stage-only modes ─────────────────────────────
  if ((mode === 'atualizar_etapa' || mode === 'somente_etapa') && !wh.stage_id) {
    log.warn('webhook_inbound.create_mode_missing_stage', { webhook_id: wh.id, mode });
    const errorMessage = 'create_mode requires stage_id';
    const responseBody = { success: false, error: errorMessage };

    await supabase.from('webhook_logs').insert({
      webhook_id: null,
      request_body: { _inbound_webhook_id: wh.id, ...body },
      response_body: responseBody,
      status_code: 400,
      error_message: errorMessage,
    }).then(() => null).catch(() => null);

    return new Response(
      JSON.stringify(responseBody),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  // ── 4. Apply field_mapping → flat crmData ──────────────────────────────────
  const mappings: FieldMapping[] = Array.isArray(wh.field_mapping) ? wh.field_mapping : [];
  const crmData: Record<string, string> = {};

  for (const m of mappings) {
    if (!m?.source_key || !m?.crm_field) continue;
    const val = extractValue(body, m.source_key);
    if (val !== null && val !== '') {
      crmData[m.crm_field] = val;
    }
  }

  log.info('payload_mapped', {
    webhook_id: wh.id,
    mapped_fields: Object.keys(crmData),
    skipped: mappings.length - Object.keys(crmData).length,
  });

  // ── 5. Process CRM data — bifurcate by create_mode ─────────────────────────
  type ProcessResult = {
    personId: string | null;
    companyId: string | null;
    leadId: string | null;
    isExistingLead: boolean;
  };

  let result: ProcessResult;
  let action: 'created' | 'updated' | 'skipped';

  try {
    if (mode === 'criar' || mode === 'criar_se_nao_existir') {
      const r = await processCrmData(
        supabase,
        crmData,
        {
          pipelineId: wh.pipeline_id,
          configuredStageId: wh.stage_id,
          formName: wh.name,
          source: `webhook:${wh.name}`,
          forceCreateLead: mode === 'criar',
        },
        log,
      );
      result = r;
      if (!r.leadId) {
        action = 'skipped';
      } else if (mode === 'criar') {
        action = 'created';
      } else {
        action = r.isExistingLead ? 'updated' : 'created';
      }
    } else {
      // atualizar_etapa | somente_etapa
      // NOTE: V1 — `somente_etapa` shares behavior with `atualizar_etapa`.
      //       Future divergence (e.g. skip company upsert) goes here.
      const { pessoa, empresa } = parseCrmBuckets(crmData);
      const personId = await upsertPerson(supabase, pessoa, `webhook:${wh.name}`);

      if (!personId) {
        result = { personId: null, leadId: null, companyId: null, isExistingLead: false };
        action = 'skipped';
      } else {
        const companyId = empresa.nome ? await upsertCompany(supabase, empresa, personId) : null;
        const updatedLeadId = await updateLeadStage(supabase, {
          personId,
          pipelineId: wh.pipeline_id!,
          stageId: wh.stage_id!,
        });
        result = {
          personId,
          companyId,
          leadId: updatedLeadId,
          isExistingLead: !!updatedLeadId,
        };
        action = updatedLeadId ? 'updated' : 'skipped';
      }
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'CRM processing failed';
    log.error('crm_processing_error', { error: errorMessage });

    await supabase.from('webhook_logs').insert({
      webhook_id: null,
      request_body: { _inbound_webhook_id: wh.id, ...body },
      response_body: { success: false, error: 'Internal error' },
      status_code: 500,
      error_message: errorMessage,
    }).then(() => null).catch(() => null);

    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  log.info('create_mode_applied', { webhook_id: wh.id, mode, action });

  // ── 6. Trigger dispatch (best-effort) ──────────────────────────────────────
  // Only when something was actually created/updated.
  let triggerDispatched = false;
  if (action !== 'skipped') {
    triggerDispatched = await maybeDispatchTrigger(
      supabase,
      wh,
      crmData,
      result.personId,
      result.leadId,
      log,
    );
  }

  // ── 7. Log + respond ───────────────────────────────────────────────────────
  const responseBody = {
    success: true,
    person_id: result.personId,
    lead_id: result.leadId,
    company_id: result.companyId,
    existing_lead: result.isExistingLead,
    action,
    trigger_dispatched: triggerDispatched,
  };

  await supabase.from('webhook_logs').insert({
    webhook_id: null,
    request_body: { _inbound_webhook_id: wh.id, ...body },
    response_body: responseBody,
    status_code: 200,
    error_message: null,
  }).then(() => null).catch(() => null);

  log.info('webhook_processed', {
    webhook_id: wh.id,
    person_id: result.personId,
    lead_id: result.leadId,
    existing: result.isExistingLead,
    action,
    trigger_dispatched: triggerDispatched,
  });

  return new Response(
    JSON.stringify(responseBody),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
  );
});
