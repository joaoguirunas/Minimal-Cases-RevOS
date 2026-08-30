/**
 * kiwify-dispatch-worker (KFY-1.5) — GOD NODE (writes `messages`).
 *
 * pg_cron (1 min) drains due kiwify_message_jobs, applies the opt-in gate, renders the
 * template, sends via whatsapp-outbound and records the message. Mirrors
 * followup-trigger-worker's dispatch pattern; queue is the dedicated kiwify_message_jobs
 * table (ADR-KFY-01), not followup_queue.
 *
 * Opt-in gate (AC7, ratified): read whatsapp_templates.json_data->>'category'.
 *   UTILITY → send always. MARKETING (or unresolved category, fail-safe) → only when the
 *   contact has whatsapp_optin=true; otherwise the job becomes 'skipped_no_optin'.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { canSend, categoryFromJsonData, renderTemplate } from '../_shared/kiwify-events.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60_000;
const BATCH = 50;

interface JobRow {
  id: string;
  people_id: string | null;
  lead_id: string | null;
  order_id: string | null;
  trigger: string;
  step_index: number;
  template_id: string | null;
  variables: Record<string, string> | null;
  retry_count: number;
}

type TplComponent = { type: string; format?: string; text?: string; parameters?: unknown };

/**
 * Build Meta template components from the template's declared components, filling each
 * {{token}} with the job's rendered variables (NAMED parameters). Only HEADER/BODY text
 * variables are populated; buttons/media are passed through untouched.
 */
function buildComponents(
  templateComponents: TplComponent[],
  vars: Record<string, string>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const comp of templateComponents) {
    const type = (comp.type ?? '').toUpperCase();
    if ((type === 'BODY' || type === 'HEADER') && comp.format !== 'IMAGE' && comp.text) {
      const tokens = [...comp.text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1]);
      if (tokens.length === 0) continue;
      out.push({
        type: type.toLowerCase(),
        parameters: tokens.map((t) => ({ type: 'text', parameter_name: t, text: vars[t.toLowerCase()] ?? '' })),
      });
    }
  }
  return out;
}

/** Render a plain-text preview of the template body for the persisted message content. */
function renderBodyText(templateComponents: TplComponent[], vars: Record<string, string>): string {
  const body = templateComponents.find((c) => (c.type ?? '').toUpperCase() === 'BODY' && c.text);
  return body?.text ? renderTemplate(body.text, vars) : '';
}

async function finalize(
  supabase: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase.from('kiwify_message_jobs').update(patch).eq('id', jobId);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const log = createLogger('kiwify-dispatch-worker');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { data: jobs } = await supabase
      .from('kiwify_message_jobs')
      .select('id, people_id, lead_id, order_id, trigger, step_index, template_id, variables, retry_count')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(BATCH);

    if (!jobs || jobs.length === 0) return json({ processed: 0 });

    let sent = 0, skipped = 0, failed = 0;

    for (const job of jobs as JobRow[]) {
      const vars = job.variables ?? {};

      if (!job.template_id) {
        await finalize(supabase, job.id, { status: 'failed', error_message: 'template_id ausente (automação não configurada)', fired_at: new Date().toISOString() });
        failed++;
        continue;
      }
      if (!job.people_id) {
        await finalize(supabase, job.id, { status: 'failed', error_message: 'people_id ausente', fired_at: new Date().toISOString() });
        failed++;
        continue;
      }

      // Contact + opt-in
      const { data: person } = await supabase
        .from('clients_people')
        .select('name, whatsapp, telefone, whatsapp_optin')
        .eq('id', job.people_id).maybeSingle();
      const p = person as { name: string | null; whatsapp: string | null; telefone: string | null; whatsapp_optin: boolean } | null;
      const toNumber = p?.whatsapp ?? p?.telefone ?? null;
      if (!p || !toNumber) {
        await finalize(supabase, job.id, { status: 'failed', error_message: 'contato sem telefone', fired_at: new Date().toISOString() });
        failed++;
        continue;
      }

      // Template category → opt-in gate. category/MARKETING-UTILITY é conceito
      // específico da Meta (regra de compliance da Cloud API); filtra provider='meta'
      // explicitamente — sem isso, .maybeSingle() erroraria com "multiple rows"
      // agora que templates Meta e Evolution podem compartilhar o mesmo name
      // (réplica 1:1 entre providers).
      const { data: tpl } = await supabase
        .from('whatsapp_templates')
        .select('json_data')
        .eq('name', job.template_id).eq('provider', 'meta').maybeSingle();
      const jsonData = (tpl as { json_data: Record<string, unknown> } | null)?.json_data ?? null;
      const category = categoryFromJsonData(jsonData);

      if (!canSend(category, p.whatsapp_optin === true)) {
        await finalize(supabase, job.id, { status: 'skipped_no_optin', error_message: `sem opt-in p/ categoria ${category ?? 'desconhecida'}`, fired_at: new Date().toISOString() });
        skipped++;
        continue;
      }

      if (!jsonData) {
        await finalize(supabase, job.id, { status: 'failed', error_message: `template '${job.template_id}' não encontrado`, fired_at: new Date().toISOString() });
        failed++;
        continue;
      }

      const tplComponents = (jsonData.components as TplComponent[]) ?? [];
      const languageCode = (jsonData.language ?? jsonData.languageCode) as string | undefined;
      const components = buildComponents(tplComponents, vars);
      const contentText = renderBodyText(tplComponents, vars);

      // Pre-insert the message row so whatsapp-outbound can update it by id.
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          people_id: job.people_id,
          lead_id: job.lead_id ?? undefined,
          channel: 'whatsapp',
          from_contact: 'sistema',
          source_type: 'kiwify',
          status: 'pending',
          content: contentText,
          metadata: {
            template_name: job.template_id,
            language_code: languageCode ?? 'pt_BR',
            components,
            kiwify_trigger: job.trigger,
            kiwify_step: job.step_index,
          },
        })
        .select('id')
        .single();

      if (msgErr || !msg) {
        await bumpRetryOrFail(supabase, job, 'falha ao criar mensagem');
        failed++;
        continue;
      }
      const messageId = (msg as { id: number }).id;

      // Dispatch via whatsapp-outbound (reused; no new WA client).
      let ok = false;
      let errMsg: string | null = null;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-outbound`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            to: toNumber,
            // Sem phone_number_id explícito — whatsapp-outbound resolve o canal
            // certo (Meta ou Evolution) via people_id -> active_channel_id.
            people_id: job.people_id,
            lead_id: job.lead_id ?? null,
            message_ids: [messageId],
            messages: [{
              type: 'template',
              template_name: job.template_id,
              ...(languageCode ? { language_code: languageCode } : {}),
              ...(components.length > 0 ? { components } : {}),
            }],
          }),
        });
        const body = await res.json().catch(() => ({})) as { sent?: number; failed?: number; error?: string };
        ok = res.ok && (body.sent ?? 0) > 0 && (body.failed ?? 0) === 0;
        if (!ok) errMsg = body.error ?? `WA sent=${body.sent ?? 0} failed=${body.failed ?? 0}`;
      } catch (e) {
        errMsg = (e as Error).message;
      }

      if (ok) {
        await finalize(supabase, job.id, { status: 'sent', message_id: messageId, fired_at: new Date().toISOString(), error_message: null });
        sent++;
      } else {
        // Failed send: clean up the pending message row and retry with backoff or fail.
        await supabase.from('messages').update({ status: 'error' }).eq('id', messageId);
        await bumpRetryOrFail(supabase, job, errMsg ?? 'falha no envio');
        failed++;
      }
    }

    log.info('done', { processed: jobs.length, sent, skipped, failed });
    return json({ processed: jobs.length, sent, skipped, failed });
  } catch (e) {
    log.error('unhandled', { error: (e as Error).message });
    return json({ error: 'internal error' }, 500);
  }
});

/** Reschedule a failed job (retry with delay) until MAX_RETRIES, then mark failed. */
async function bumpRetryOrFail(supabase: SupabaseClient, job: JobRow, error: string): Promise<void> {
  const next = job.retry_count + 1;
  if (next < MAX_RETRIES) {
    await supabase.from('kiwify_message_jobs').update({
      retry_count: next,
      scheduled_for: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
      error_message: error,
    }).eq('id', job.id);
  } else {
    await supabase.from('kiwify_message_jobs').update({
      status: 'failed', retry_count: next, error_message: error, fired_at: new Date().toISOString(),
    }).eq('id', job.id);
  }
}
