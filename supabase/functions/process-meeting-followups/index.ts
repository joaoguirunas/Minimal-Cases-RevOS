/**
 * Meeting Follow-up Processor
 *
 * POST /process-meeting-followups
 *
 * Called by pg_cron every 5 minutes.
 * Finds pending queue entries where scheduled_for <= now().
 *
 * Dispatch logic (FWUP-02 — routed by rule.source):
 *  source = 'webhook'  → POST rule.webhook_url (N8N or any external webhook)
 *  source = 'channel'  → direct dispatch:
 *    whatsapp_template_id set                  → WA template via whatsapp-outbound
 *    fallback                                  → fail-closed (no silent no-op)
 *
 * Single-tenant: no tenant_id filtering needed.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface WhatsAppTemplate {
  id: string;
  name: string;
  meta_template_name: string;
  status: string;
  json_data: {
    language?: string;
    components?: Array<{
      type: string;
      text?: string;
      buttons?: Array<{ type: string; url?: string }>;
    }>;
  } | null;
}

interface BusinessHoursConfig {
  id: string;
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  days_of_week: number[];
  timezone: string;
  bh_only_last: boolean;
}

interface QueueEntry {
  id: string;
  rule_id: string;
  meeting_id: string;
  person_id: string | null;
  lead_id: string | null;
  scheduled_for: string;
  held_for_bh: boolean;
  original_scheduled_for: string | null;
  channel: string;
  webhook_url: string;
  message_snapshot: string | null;
  template_id: string | null;
  // Joined
  rule: {
    id: string;
    name: string | null;
    meeting_status: string;
    days: number;
    hours: number;
    minutes: number;
    channel: string;
    message: string | null;
    webhook_url: string | null;
    whatsapp_template_id: string | null;
    source: 'webhook' | 'channel';
    business_hours_only: boolean;
  } | null;
  meeting: {
    id: string;
    title: string;
    start_time: string;
    end_time: string | null;
    status: string;
    location: string | null;
    notes: string | null;
    meeting_link: string | null;
    user_id?: string | null;
  } | null;
  person: {
    id: string;
    name: string | null;
    whatsapp: string | null;
    email: string | null;
  } | null;
  lead: {
    id: string;
    title: string | null;
  } | null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase     = createClient(supabaseUrl, serviceKey);
  const log          = createLogger('process-meeting-followups');

  const now = new Date().toISOString();
  const results = { processed: 0, sent: 0, failed: 0 };

  try {
    // ── Fetch business hours settings (once per invocation) ───────────────────
    const { data: bhRow } = await supabase
      .from('settings_business_hours')
      .select('*')
      .limit(1)
      .maybeSingle();
    const bhSettings = bhRow as BusinessHoursConfig | null;
    // ── FWUP-06: Retry stale 'queued' entries (N8N callback timeout) ──────────
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const MAX_MEETING_RETRIES = 3;

    const { data: staleEntries } = await supabase
      .from('meeting_followup_queue')
      .select('id, retry_count')
      .eq('status', 'queued')
      .lt('scheduled_for', staleThreshold)
      .lt('retry_count', MAX_MEETING_RETRIES)
      .limit(50);

    if (staleEntries && staleEntries.length > 0) {
      for (const e of staleEntries) {
        const newCount    = (e.retry_count as number) + 1;
        const isExhausted = newCount >= MAX_MEETING_RETRIES;

        if (isExhausted) {
          const errorMsg = `Meeting followup abandonado após ${MAX_MEETING_RETRIES} tentativas sem callback`;
          await supabase
            .from('meeting_followup_queue')
            .update({ status: 'failed', retry_count: newCount, response_body: errorMsg })
            .eq('id', e.id)
            .eq('status', 'queued');

          log.warn('meeting_queue_entry_exhausted', { entry_id: e.id, retry_count: newCount });
          results.failed++;
        } else {
          await supabase
            .from('meeting_followup_queue')
            .update({ status: 'pending', retry_count: newCount })
            .eq('id', e.id)
            .eq('status', 'queued');

          log.info('meeting_queue_entry_requeued', { entry_id: e.id, retry_count: newCount });
        }
      }
    }

    // ── Fetch pending entries due now ─────────────────────────────────────────
    const { data: entries, error: fetchErr } = await supabase
      .from('meeting_followup_queue')
      .select(`
        id, rule_id, meeting_id, person_id, lead_id,
        scheduled_for, held_for_bh, original_scheduled_for,
        channel, webhook_url, message_snapshot, template_id,
        rule:meetings_followups!rule_id (
          id, name, meeting_status, days, hours, minutes, channel, message,
          webhook_url, whatsapp_template_id, source, business_hours_only
        ),
        meeting:meetings!meeting_id (
          id, title, start_time, end_time, status, location, notes, meeting_link, user_id
        ),
        person:clients_people!person_id (
          id, name, whatsapp, email
        ),
        lead:leads!lead_id (
          id, title
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ ...results, message: 'No pending follow-ups' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Pre-load internal user emails to exclude from attendee_emails fallback
    const { data: internalUsers } = await supabase.from('settings_users').select('email');
    const internalEmails = new Set(
      (internalUsers ?? []).map((u: any) => (u.email ?? '').toLowerCase()).filter(Boolean)
    );

    // ── Process each entry ────────────────────────────────────────────────────
    for (const raw of entries) {
      const entry = raw as unknown as QueueEntry;
      results.processed++;

      // ── Resolve person from lead when people_id is missing ──────────────
      if (!entry.person && entry.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('people_id, client_people:clients_people!people_id(id, name, whatsapp, email)')
          .eq('id', entry.lead_id)
          .single();
        if (lead?.client_people) {
          entry.person = lead.client_people as unknown as QueueEntry['person'];
          entry.person_id = lead.people_id;
        }
      }

      // ── Resolve person from meeting when both queue IDs are null ──
      if (!entry.person && !entry.lead_id && entry.meeting_id) {
        const { data: mtg } = await supabase
          .from('meetings')
          .select('people_id, lead_id, attendee_emails')
          .eq('id', entry.meeting_id)
          .single();

        if (mtg?.person_id) {
          const { data: p } = await supabase
            .from('clients_people')
            .select('id, name, whatsapp, email')
            .eq('id', mtg.people_id)
            .single();
          if (p) {
            entry.person = p as unknown as QueueEntry['person'];
            entry.person_id = mtg.people_id;
          }
        } else if (mtg?.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('people_id, client_people:clients_people!people_id(id, name, whatsapp, email)')
            .eq('id', mtg.lead_id)
            .single();
          if (lead?.client_people) {
            entry.person = lead.client_people as unknown as QueueEntry['person'];
            entry.person_id = lead.people_id;
          }
        }

        // ── Fallback: resolve from attendee_emails (GCal-synced meetings) ──
        // Exclude internal users — they are consultants, not clients
        const externalAttendees = (mtg?.attendee_emails ?? []).filter(
          (e: string) => e && !internalEmails.has(e.toLowerCase())
        );
        if (!entry.person && externalAttendees.length > 0) {
          const { data: matchedPeople } = await supabase
            .from('clients_people')
            .select('id, name, whatsapp, email')
            .in('email', externalAttendees)
            .limit(1);
          if (matchedPeople && matchedPeople.length > 0) {
            entry.person = matchedPeople[0] as unknown as QueueEntry['person'];
            entry.person_id = matchedPeople[0].id;
            // Also backfill meeting.people_id for future lookups
            await supabase.from('meetings').update({ people_id: matchedPeople[0].id }).eq('id', entry.meeting_id);
          }
        }
      }

      let responseStatus = 0;
      let responseBody   = '';
      let success        = false;

      const rule = entry.rule;

      // ── Business hours hold logic ─────────────────────────────────────────
      if (rule?.business_hours_only && bhSettings?.enabled) {
        const nowDate = new Date();
        if (!isWithinBusinessHours(nowDate, bhSettings)) {
          const nextOpen = getNextBusinessHoursStart(nowDate, bhSettings);
          await supabase
            .from('meeting_followup_queue')
            .update({
              scheduled_for:           nextOpen.toISOString(),
              held_for_bh:             true,
              original_scheduled_for:  entry.original_scheduled_for ?? entry.scheduled_for,
            })
            .eq('id', entry.id);
          log.info('followup_held_for_bh', { entry_id: entry.id, next_open: nextOpen.toISOString() });
          results.processed++;
          continue;
        }

        // Within business hours: if this was held and bh_only_last=true (global), cancel if a newer one exists
        if (entry.held_for_bh && bhSettings.bh_only_last) {
          const originalTs = entry.original_scheduled_for ?? entry.scheduled_for;
          const { data: newerHeld } = await supabase
            .from('meeting_followup_queue')
            .select('id')
            .eq('meeting_id', entry.meeting_id)
            .eq('held_for_bh', true)
            .neq('id', entry.id)
            .gt('original_scheduled_for', originalTs)
            .not('status', 'eq', 'cancelled')
            .limit(1);

          if (newerHeld && newerHeld.length > 0) {
            await supabase
              .from('meeting_followup_queue')
              .update({
                status:        'cancelled',
                fired_at:      new Date().toISOString(),
                response_body: 'Cancelado: substituído por follow-up mais recente no horário comercial',
              })
              .eq('id', entry.id);
            log.info('followup_held_cancelled_by_newer', { entry_id: entry.id });
            results.processed++;
            continue;
          }
        }
      }

      // ── FWUP-02: Route by rule.source ─────────────────────────────────────
      // source = 'webhook'  → external webhook (N8N or any HTTP endpoint)
      // source = 'channel'  → direct channel dispatch (AS, WA template, etc.)
      // Fallback to heuristic for legacy rows without source (treat as 'channel')
      const ruleSource = rule?.source ?? 'channel';

      if (ruleSource === 'webhook') {
        // ── Path WEBHOOK: POST to webhook_url ────────────────────────────────
        const webhookUrl = entry.webhook_url || rule?.webhook_url;
        if (!webhookUrl) {
          await supabase
            .from('meeting_followup_queue')
            .update({
              status:        'failed',
              fired_at:      new Date().toISOString(),
              response_body: 'source=webhook mas webhook_url ausente na regra e na fila',
            })
            .eq('id', entry.id);
          results.failed++;
          log.error('followup_webhook_missing_url', { entry_id: entry.id, rule_id: entry.rule_id });
          continue;
        }

        const payload = {
          event: 'meeting_followup',
          queue_id: entry.id,
          rule: rule
            ? {
                id:             rule.id,
                name:           rule.name,
                channel:        rule.channel,
                meeting_status: rule.meeting_status,
                days:           rule.days,
                hours:          rule.hours,
                minutes:        rule.minutes,
                message:        rule.message,
                source:         rule.source,
              }
            : null,
          meeting: entry.meeting
            ? {
                id:         entry.meeting.id,
                title:      entry.meeting.title,
                start_time: entry.meeting.start_time,
                end_time:   entry.meeting.end_time,
                status:     entry.meeting.status,
                location:   entry.meeting.location,
              }
            : null,
          person: entry.person
            ? {
                id:       entry.person.id,
                name:     entry.person.name,
                whatsapp: entry.person.whatsapp,
                email:    entry.person.email,
              }
            : null,
          lead:          entry.lead ? { id: entry.lead.id, title: entry.lead.title } : null,
          scheduled_for: entry.scheduled_for,
          channel:       entry.channel,
        };

        try {
          const webhookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          responseStatus = webhookRes.status;
          responseBody   = await webhookRes.text().catch(() => '');
          success        = webhookRes.status >= 200 && webhookRes.status < 300;
        } catch (err) {
          responseStatus = 0;
          responseBody   = err instanceof Error ? err.message : String(err);
          success        = false;
        }

        await supabase
          .from('meeting_followup_queue')
          .update({
            status:          success ? 'sent' : 'failed',
            fired_at:        new Date().toISOString(),
            response_status: responseStatus,
            response_body:   responseBody.slice(0, 2000),
          })
          .eq('id', entry.id);

        if (success) {
          results.sent++;
          await registerOmniMessage(supabase, entry);
        } else {
          results.failed++;
          log.error('followup_webhook_failed', { entry_id: entry.id, http_status: responseStatus, response: responseBody.slice(0, 200) });
        }
        continue;
      }

      // ── Path CHANNEL: direct dispatch ─────────────────────────────────────
      // Sub-path C: WhatsApp template
      const templateId = entry.template_id || rule?.whatsapp_template_id;
      if (templateId) {
        if (!entry.person?.whatsapp) {
          const reason = !entry.person
            ? 'Contato não encontrado (meeting sem people_id/lead_id vinculado)'
            : 'Contato sem número de WhatsApp';
          await supabase
            .from('meeting_followup_queue')
            .update({
              status:        'failed',
              fired_at:      new Date().toISOString(),
              response_body: reason,
            })
            .eq('id', entry.id);
          results.failed++;
          log.error('followup_skipped', { entry_id: entry.id, reason });
          continue;
        }

        const templateResult = await sendWhatsAppTemplate(supabase, entry, templateId);

        await supabase
          .from('meeting_followup_queue')
          .update({
            status:          templateResult.success ? 'sent' : 'failed',
            fired_at:        new Date().toISOString(),
            response_status: templateResult.status,
            response_body:   templateResult.body.slice(0, 2000),
          })
          .eq('id', entry.id);

        if (templateResult.success) {
          results.sent++;
        } else {
          results.failed++;
          log.error('followup_wa_template_failed', { entry_id: entry.id, response: templateResult.body.slice(0, 200) });
        }
        continue;
      }

      // Sub-path CHANNEL fallback: no AS queue, no template → fail-closed
      await supabase
        .from('meeting_followup_queue')
        .update({
          status:        'failed',
          fired_at:      new Date().toISOString(),
          response_body: 'source=channel mas nenhum canal configurado (sem whatsapp_template_id)',
        })
        .eq('id', entry.id);
      results.failed++;
      log.error('followup_channel_no_dispatcher', { entry_id: entry.id, rule_id: entry.rule_id });
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : ((err as any)?.message ?? JSON.stringify(err));
    log.error('unhandled_error', { error: errMsg });
    return new Response(
      JSON.stringify({ error: errMsg, ...results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ── Business hours helpers ────────────────────────────────────────────────────

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getTzParts(date: Date, tz: string): { dow: number; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone:  tz,
      weekday:   'short',
      hour:      'numeric',
      hour12:    false,
    }).formatToParts(date).map(({ type, value }) => [type, value])
  );
  const h = parseInt(parts.hour, 10);
  return {
    dow:  WEEKDAY_MAP[parts.weekday] ?? 0,
    hour: h === 24 ? 0 : h,
  };
}

function isWithinBusinessHours(date: Date, cfg: BusinessHoursConfig): boolean {
  const { dow, hour } = getTzParts(date, cfg.timezone);
  return cfg.days_of_week.includes(dow) && hour >= cfg.start_hour && hour < cfg.end_hour;
}

function getNextBusinessHoursStart(now: Date, cfg: BusinessHoursConfig): Date {
  // Advance to the start of the next hour, then iterate hourly until we land on start_hour of a working day
  const candidate = new Date(now);
  candidate.setMinutes(0, 0, 0);
  candidate.setTime(candidate.getTime() + 60 * 60 * 1000);

  for (let i = 0; i < 200; i++) {
    const { dow, hour } = getTzParts(candidate, cfg.timezone);
    if (cfg.days_of_week.includes(dow) && hour === cfg.start_hour) {
      return new Date(candidate);
    }
    candidate.setTime(candidate.getTime() + 60 * 60 * 1000);
  }
  // Fallback: next hour (should never happen)
  return new Date(now.getTime() + 60 * 60 * 1000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/**
 * Send a WhatsApp template message via the whatsapp-outbound edge function.
 * Reuses the same variable-mapping pattern from send-meeting-confirmation.
 */
async function sendWhatsAppTemplate(
  supabase: ReturnType<typeof createClient>,
  entry: QueueEntry,
  templateId: string,
): Promise<{ success: boolean; status: number; body: string }> {
  try {
    // 1. Look up template
    const { data: template, error: tplErr } = await supabase
      .from('whatsapp_templates')
      .select('id, name, meta_template_name, status, json_data')
      .eq('id', templateId)
      .single();

    if (tplErr || !template) {
      return { success: false, status: 0, body: `Template ${templateId} não encontrado` };
    }
    if (template.status !== 'approved') {
      return { success: false, status: 0, body: `Template "${template.name}" não está aprovado (status: ${template.status})` };
    }

    const tpl = template as WhatsAppTemplate;

    // Skip confirmacao_reuniao for consultoria pipeline — wa_confirm handles it with a specific template
    if (tpl.meta_template_name === 'confirmacao_reuniao' && entry.lead_id) {
      const CONSULTORIA_PIPELINE_ID = 'f8d449e5-7716-4c52-8fe7-b65cc15fb498';
      const { data: lead } = await supabase
        .from('leads')
        .select('leads_pipelines_id')
        .eq('id', entry.lead_id)
        .maybeSingle();
      if (lead?.leads_pipelines_id === CONSULTORIA_PIPELINE_ID) {
        return { success: true, status: 0, body: 'Skipped: consultoria pipeline — wa_confirm handles booking confirmation' };
      }
    }

    // 2. Build variables from meeting data
    const personName = entry.person?.name || 'Cliente';
    const { date, time } = entry.meeting?.start_time
      ? formatDateTime(entry.meeting.start_time)
      : { date: '', time: '' };

    // For no-show templates: booking URL. For others: meeting link (GCal), fallback to booking URL.
    const isNoShow = entry.rule?.meeting_status === 'nao_compareceu';
    const siteUrl = Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? '';
    const bookingUrl = entry.lead_id && siteUrl ? `${siteUrl}/agendar/${entry.lead_id}?d=30` : '';
    const meetLink = isNoShow
      ? bookingUrl
      : (entry.meeting?.meeting_link || bookingUrl || 'indisponível');

    // 3. Detect template variables and build Meta components
    const components = tpl.json_data?.components || [];
    const bodyComponent = components.find((c) => c.type === 'BODY');
    const headerComponent = components.find((c) => c.type === 'HEADER');
    const bodyText = bodyComponent?.text || '';
    const headerText = headerComponent?.text || '';

    const bodyVars = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1]));
    const headerVars = [...headerText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1]));

    // Look up consultant name for {{5}}
    let consultantName = '';
    if (entry.meeting?.user_id) {
      const { data: consultant } = await supabase
        .from('settings_users')
        .select('name')
        .eq('id', entry.meeting.user_id)
        .maybeSingle();
      consultantName = (consultant as { name?: string } | null)?.name ?? '';
    }

    // Templates with compressed sequential variable numbering (no gaps allowed by Meta)
    const TEMPLATE_VAR_MAPS: Record<string, Record<number, string>> = {
      lembrete_2h_v2:    { 1: personName, 2: time,     3: meetLink },
      lembrete_30min:    { 1: personName, 2: meetLink },
      lembrete_5min:     { 1: personName, 2: time,     3: meetLink },
      ausencia_imediato: { 1: personName, 2: meetLink },
      ausencia_6h:       { 1: personName, 2: meetLink },
      ausencia_24h:      { 1: personName, 2: meetLink },
    };

    const varValues: Record<number, string> =
      TEMPLATE_VAR_MAPS[tpl.meta_template_name] ??
      { 1: personName, 2: date, 3: time, 4: meetLink, 5: consultantName };
    const metaComponents: Array<Record<string, unknown>> = [];

    if (headerVars.length > 0) {
      metaComponents.push({
        type: 'header',
        parameters: headerVars.sort().map((n) => ({ type: 'text', text: varValues[n] || '' })),
      });
    }

    if (bodyVars.length > 0) {
      metaComponents.push({
        type: 'body',
        parameters: bodyVars.sort().map((n) => ({ type: 'text', text: varValues[n] || '' })),
      });
    }

    // URL button with dynamic variable
    // For no-show templates: button {{1}} = "leadId?d=30" (appended to base URL in template)
    // For other templates: button {{1}} = full meeting link (Google Meet)
    const buttonUrlValue = isNoShow && entry.lead_id
      ? `${entry.lead_id}?d=30`
      : meetLink;

    const buttonsComponent = components.find((c) => c.type === 'BUTTONS');
    if (buttonsComponent?.buttons) {
      buttonsComponent.buttons.forEach((btn: { type: string; url?: string }, idx: number) => {
        if (btn.type === 'URL' && btn.url && /\{\{1\}\}/.test(btn.url) && buttonUrlValue) {
          metaComponents.push({
            type: 'button',
            sub_type: 'url',
            index: idx,
            parameters: [{ type: 'text', text: buttonUrlValue }],
          });
        }
      });
    }

    // 4. Build rendered content for message record
    let renderedContent = bodyText;
    renderedContent = renderedContent.replace(
      /\{\{(\d+)\}\}/g,
      (_: string, n: string) => varValues[parseInt(n)] || `{{${n}}}`,
    );

    // 5. Insert message record
    const { data: insertedMsg } = await supabase
      .from('messages')
      .insert({
        people_id: entry.person_id,
        lead_id: entry.lead_id ?? null,
        content: renderedContent || entry.message_snapshot || `[Follow-up WhatsApp — ${tpl.name}]`,
        channel: 'whatsapp',
        from_contact: 'sistema',
        message_type: 'texto',
        status: 'pending',
        source_type: 'appointment_reminder',
        whatsapp_template_id: tpl.meta_template_name,
      })
      .select('id')
      .single();

    // 6. Call whatsapp-outbound
    const outboundPayload = {
      to: entry.person!.whatsapp,
      messages: [{
        type: 'template',
        template_name: tpl.meta_template_name,
        language_code: tpl.json_data?.language || 'pt_BR',
        components: metaComponents,
      }],
      people_id: entry.person_id,
      message_ids: insertedMsg ? [insertedMsg.id] : [],
    };

    const { error: outboundErr } = await supabase.functions.invoke('whatsapp-outbound', {
      body: outboundPayload,
    });

    if (outboundErr) {
      return { success: false, status: 502, body: `whatsapp-outbound error: ${outboundErr.message}` };
    }

    return { success: true, status: 200, body: `Template "${tpl.meta_template_name}" sent to ${entry.person!.whatsapp}` };
  } catch (err) {
    return { success: false, status: 0, body: err instanceof Error ? err.message : String(err) };
  }
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email:    'E-mail',
    sms:      'SMS',
    ligacao:  'Ligação',
    phone:    'Ligação',
  };
  return labels[channel] ?? channel;
}

function omniChannel(channel: string): string {
  const map: Record<string, string> = {
    phone:   'telefone',
    ligacao: 'telefone',
  };
  return map[channel] ?? channel;
}

/**
 * Register follow-up dispatch as a message in OMNI PRO (best-effort).
 * Uses the correct `people_id` column and includes all fields the
 * OMNI message bus expects.
 */
async function registerOmniMessage(
  supabase: ReturnType<typeof createClient>,
  entry: QueueEntry,
): Promise<void> {
  if (!entry.person_id) return;

  const content = entry.message_snapshot
    || `[Follow-up automático — ${channelLabel(entry.channel)}]`;

  const { error } = await supabase
    .from('messages')
    .insert({
      people_id:    entry.person_id,
      leads_id:     entry.lead_id ?? null,
      content,
      channel:      omniChannel(entry.channel),
      from_contact: 'sistema',
      message_type: 'texto',
      status:       'delivered',
      source_type:  'appointment_reminder',
    });

  if (error) {
    createLogger('process-meeting-followups').error('omni_insert_failed', { entry_id: entry.id, error: error.message });
  }
}
