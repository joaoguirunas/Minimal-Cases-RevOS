import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmailWithConfig,
  hasDirectEmailProvider,
  type EmailConfig,
} from "../_shared/email-provider.ts";

// ── Business hours helpers ────────────────────────────────────────────────────

interface BusinessHoursConfig {
  id: string;
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  days_of_week: number[];
  timezone: string;
  bh_only_last: boolean;
}

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getTzParts(date: Date, tz: string): { dow: number; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', hour: 'numeric', hour12: false,
    }).formatToParts(date).map(({ type, value }) => [type, value])
  );
  const h = parseInt(parts.hour, 10);
  return { dow: WEEKDAY_MAP[parts.weekday] ?? 0, hour: h === 24 ? 0 : h };
}

function isWithinBusinessHours(date: Date, cfg: BusinessHoursConfig): boolean {
  const { dow, hour } = getTzParts(date, cfg.timezone);
  return cfg.days_of_week.includes(dow) && hour >= cfg.start_hour && hour < cfg.end_hour;
}

function getNextBusinessHoursStart(now: Date, cfg: BusinessHoursConfig): Date {
  const candidate = new Date(now);
  candidate.setMinutes(0, 0, 0);
  candidate.setTime(candidate.getTime() + 60 * 60 * 1000);
  for (let i = 0; i < 200; i++) {
    const { dow, hour } = getTzParts(candidate, cfg.timezone);
    if (cfg.days_of_week.includes(dow) && hour === cfg.start_hour) return new Date(candidate);
    candidate.setTime(candidate.getTime() + 60 * 60 * 1000);
  }
  return new Date(now.getTime() + 60 * 60 * 1000);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * followup-trigger-worker
 *
 * Chamado por pg_cron (a cada minuto) ou endpoint externo.
 * Busca followup_queue com status=pending e scheduled_for<=now().
 * - whatsapp_template: dispara diretamente via whatsapp-outbound (sem N8N).
 * - outros canais: POST para webhooks ativos de event_type='followup'.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch business hours settings (once per invocation)
    const { data: bhRow } = await supabase
      .from('settings_business_hours')
      .select('*')
      .limit(1)
      .maybeSingle();
    const bhSettings = bhRow as BusinessHoursConfig | null;

    // Webhooks para canais não-WA
    const { data: webhooks, error: whError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('event_type', 'followup')
      .eq('active', true);

    if (whError) throw whError;
    const activeWebhooks = webhooks ?? [];

    // Canal WA — não resolve aqui mais (isso forçava sempre o phone_number_id do
    // canal padrão, ignorando o canal Evolution e o active_channel_id de cada
    // pessoa). whatsapp-outbound resolve o canal certo por people_id; só checa se
    // existe PELO MENOS UM canal ativo (Meta OU Evolution), pra dar um erro claro
    // aqui em vez de deixar a chamada falhar sem contexto.
    let hasActiveWaChannel = false;
    {
      const { count } = await supabase
        .from('settings_whatsapp_channels')
        .select('id', { count: 'exact', head: true })
        .eq('active', true);
      hasActiveWaChannel = (count ?? 0) > 0;
    }

    // Config do canal e-mail (carregada uma vez por invocação). Se houver provider de envio
    // direto ativo (resend/smtp/sendgrid), follow-ups de e-mail saem por ele; senão caem no
    // fallback de webhook N8N (comportamento legado preservado).
    let emailConfig: EmailConfig | null = null;
    {
      const { data: emailRow } = await supabase
        .from('omni_channel_configs')
        .select('is_active, credentials')
        .eq('channel', 'email')
        .maybeSingle();
      emailConfig = (emailRow as EmailConfig | null) ?? null;
    }
    const emailProviderActive =
      !!emailConfig?.is_active && hasDirectEmailProvider(emailConfig?.credentials);

    // Reaproveitar entradas presas em 'processing' por invocação anterior que travou/crashou
    // antes de concluir (ex.: timeout de função) — evita que fiquem órfãs para sempre.
    await supabase
      .from('followup_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    // Reivindicar entradas pendentes e vencidas de forma atômica (pending → processing via
    // FOR UPDATE SKIP LOCKED). Evita que duas invocações concorrentes (ex.: cron + chamada manual)
    // peguem a mesma entrada e disparem a mesma mensagem duas vezes.
    const { data: queue, error: qError } = await supabase
      .rpc('claim_followup_queue_batch', { p_limit: 50 });

    if (qError) throw qError;

    if (!queue || queue.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum follow-up pendente', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[followup-trigger-worker] ${queue.length} entradas pendentes encontradas`);

    const results = [];

    for (const entry of queue) {
      // ── Business hours hold logic ────────────────────────────────────────
      if (entry.followup_id && bhSettings?.enabled) {
        const { data: rule } = await supabase
          .from('leads_stages_followups')
          .select('business_hours_only, bh_only_last')
          .eq('id', entry.followup_id)
          .maybeSingle();

        if (rule?.business_hours_only) {
          const nowDate = new Date();
          if (!isWithinBusinessHours(nowDate, bhSettings)) {
            const nextOpen = getNextBusinessHoursStart(nowDate, bhSettings);
            await supabase.from('followup_queue').update({
              scheduled_for:          nextOpen.toISOString(),
              held_for_bh:            true,
              original_scheduled_for: entry.original_scheduled_for ?? entry.scheduled_for,
            }).eq('id', entry.id);
            console.log(`[followup-trigger-worker] BH hold: entry ${entry.id} → ${nextOpen.toISOString()}`);
            continue;
          }

          // Within business hours: cancel older held entries if bh_only_last
          if (entry.held_for_bh && bhSettings.bh_only_last) {
            const originalTs = entry.original_scheduled_for ?? entry.scheduled_for;
            const { data: newerHeld } = await supabase
              .from('followup_queue')
              .select('id')
              .eq('lead_id', entry.lead_id)
              .eq('held_for_bh', true)
              .neq('id', entry.id)
              .gt('original_scheduled_for', originalTs)
              .not('status', 'eq', 'cancelled')
              .limit(1);

            if (newerHeld && newerHeld.length > 0) {
              await supabase.from('followup_queue').update({
                status: 'cancelled',
                fired_at: new Date().toISOString(),
                error_message: 'Cancelado: substituído por follow-up mais recente no horário comercial',
              }).eq('id', entry.id);
              continue;
            }
          }
        }
      }

      // Buscar dados do lead
      const { data: lead } = await supabase
        .from('leads')
        .select('id, title, people_id, leads_stages_id, leads_pipelines_id')
        .eq('id', entry.lead_id)
        .single();

      // Buscar dados da pessoa
      let pessoa = null;
      if (entry.person_id) {
        const { data: pessoaData } = await supabase
          .from('clients_people')
          .select('id, name, whatsapp, email, telefone')
          .eq('id', entry.person_id)
          .single();
        pessoa = pessoaData;
      }

      let success = false;
      let errorMsg: string | null = null;

      // ── whatsapp_template: disparo direto via whatsapp-outbound ─────────
      if (entry.channel === 'whatsapp_template' && entry.template_id) {
        const toNumber = entry.phone_number ?? pessoa?.whatsapp ?? pessoa?.telefone ?? null;
        if (!toNumber) {
          errorMsg = 'Sem número de telefone disponível para envio WA';
          console.warn(`[followup-trigger-worker] Entry ${entry.id}: ${errorMsg}`);
        } else if (!hasActiveWaChannel) {
          errorMsg = 'Nenhum canal WhatsApp ativo configurado';
          console.warn(`[followup-trigger-worker] Entry ${entry.id}: ${errorMsg}`);
        } else {
          // Look up template to detect header variables and pass stub components
          // whatsapp-outbound replaces empty text params with the resolved person name.
          // entry.template_id holds whatsapp_templates.id_template (Meta's numeric ID —
          // matches how the follow-up UI/picker saves it), so resolve the real Meta
          // template `name` from that row instead of sending the numeric ID to Meta.
          const { data: tplRow } = await supabase
            .from('whatsapp_templates')
            .select('name, json_data')
            .eq('id_template', entry.template_id)
            .maybeSingle();

          const resolvedTemplateName = tplRow?.name ?? entry.template_id;

          type TplComponent = { type: string; format?: string; text?: string };
          const tplComponents: TplComponent[] =
            ((tplRow?.json_data as Record<string, unknown>)?.components as TplComponent[]) ?? [];

          const headerComp = tplComponents.find(
            (c) => c.type === 'HEADER' && c.format === 'TEXT' && c.text?.includes('{{'),
          );
          // Extract param name/index from the header variable: {{nome}} → 'nome', {{1}} → '1'
          const headerParamName = headerComp?.text?.match(/\{\{([^}]+)\}\}/)?.[1] ?? null;

          const msgComponents = headerParamName
            ? [{ type: 'header', parameters: [{ type: 'text', text: '', parameter_name: headerParamName }] }]
            : [];

          // Pre-create the messages row so whatsapp-outbound can update it with the
          // wamid/status after sending — otherwise the send happens but leaves no
          // trace in the lead's conversation history (same pattern as process-meeting-followups).
          // messages.source_type CHECK constraint only allows a fixed set (inbound/manual/
          // ai_agent/campaign/form/followup/appointment_reminder/kiwify) — it does NOT
          // include 'stage'/'meeting' (that vocabulary belongs to followup_queue.source_type).
          const { data: insertedMsg, error: insertMsgError } = await supabase
            .from('messages')
            .insert({
              people_id:     entry.person_id ?? null,
              lead_id:       entry.lead_id ?? null,
              content:       entry.message || `[Follow-up WhatsApp — ${resolvedTemplateName}]`,
              channel:       'whatsapp',
              from_contact:  'sistema',
              message_type:  'texto',
              status:        'pending',
              source_type:   'followup',
              whatsapp_template_id: resolvedTemplateName,
            })
            .select('id')
            .single();

          if (insertMsgError) {
            console.error(`[followup-trigger-worker] Entry ${entry.id}: falha ao criar registro em messages:`, insertMsgError);
          }

          try {
            const waRes = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-outbound`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  to:              toNumber,
                  // Sem phone_number_id explícito — whatsapp-outbound resolve o canal
                  // certo (Meta ou Evolution) via people_id -> active_channel_id.
                  people_id:       entry.person_id ?? null,
                  lead_id:         entry.lead_id ?? null,
                  message_ids:     insertedMsg ? [insertedMsg.id] : [],
                  messages:        [{
                    type:           'template',
                    template_name:  resolvedTemplateName,
                    ...(msgComponents.length > 0 ? { components: msgComponents } : {}),
                  }],
                }),
              }
            );
            success = waRes.ok;
            if (!waRes.ok) {
              const errBody = await waRes.text().catch(() => '');
              errorMsg = `WA HTTP ${waRes.status}: ${errBody.slice(0, 200)}`;
              // Only stomp status to 'error' if whatsapp-outbound never got to resolve this row
              // itself (still 'pending') — a non-ok HTTP response doesn't always mean the Meta
              // send actually failed (e.g. slow response after a successful send already wrote 'sent').
              if (insertedMsg) {
                await supabase.from('messages').update({ status: 'error' }).eq('id', insertedMsg.id).eq('status', 'pending');
              }
            }
          } catch (fetchErr) {
            errorMsg = fetchErr instanceof Error ? fetchErr.message : 'Erro de conexão WA';
            if (insertedMsg) {
              await supabase.from('messages').update({ status: 'error' }).eq('id', insertedMsg.id).eq('status', 'pending');
            }
          }
        }

      // ── email: envio direto via provider configurado (Resend/SMTP/SendGrid) ─
      } else if (entry.channel === 'email' && emailProviderActive) {
        const toEmail = pessoa?.email ?? null;
        if (!toEmail) {
          errorMsg = 'Sem e-mail disponível para envio';
          console.warn(`[followup-trigger-worker] Entry ${entry.id}: ${errorMsg}`);
        } else {
          // Resolver subject+html: template referenciado (EMAIL-1.1) tem precedência;
          // senão usa o conteúdo inline da fila (subject + message HTML).
          let subject = entry.subject ?? '';
          let html = entry.message ?? '';

          if (entry.followup_id) {
            const { data: rule } = await supabase
              .from('leads_stages_followups')
              .select('email_template_id')
              .eq('id', entry.followup_id)
              .maybeSingle();

            if (rule?.email_template_id) {
              const { data: tpl } = await supabase
                .from('email_templates')
                .select('subject, html_body, active')
                .eq('id', rule.email_template_id)
                .maybeSingle();
              if (tpl && tpl.active !== false) {
                subject = tpl.subject ?? subject;
                html = tpl.html_body ?? html;
              }
            }
          }

          // Var-map canônico (tokens do VariablePicker: pessoa.*, lead.*). Valores de
          // dados do lead são escapados no render de HTML dentro de sendEmailWithConfig.
          const vars: Record<string, string> = {
            'pessoa.nome': pessoa?.name ?? '',
            'pessoa.email': pessoa?.email ?? '',
            'pessoa.telefone': pessoa?.telefone ?? '',
            'pessoa.whatsapp': pessoa?.whatsapp ?? '',
            'lead.titulo': lead?.title ?? '',
            // Tokens usados pelos templates da esteira Minimal (EMAIL-2.1):
            // {{nome}} = primeiro nome; {{asset_base}} = base pública das imagens
            // (env EMAIL_ASSET_BASE, ex. https://crm.suaurl.com/email-assets).
            'nome': (pessoa?.name ?? '').split(/\s+/)[0] ?? '',
            'asset_base': Deno.env.get('EMAIL_ASSET_BASE') ?? '',
          };

          const result = await sendEmailWithConfig(emailConfig!, { to: toEmail, subject, html, vars });
          success = result.success;
          if (!result.success) {
            errorMsg = result.error ?? 'Falha no envio de e-mail';
            console.warn(`[followup-trigger-worker] Entry ${entry.id} (email): ${errorMsg}`);
          }
        }

      // ── Outros canais: dispatch via webhooks (ex. N8N) ───────────────────
      } else {
        if (activeWebhooks.length === 0) {
          console.log(`[followup-trigger-worker] Entry ${entry.id}: sem webhooks ativos para canal ${entry.channel}`);
          await supabase.from('followup_queue').update({
            status: 'failed',
            fired_at: new Date().toISOString(),
            error_message: 'Nenhum webhook de followup ativo configurado',
            retry_count: entry.retry_count + 1,
          }).eq('id', entry.id);
          results.push({ id: entry.id, lead_id: entry.lead_id, channel: entry.channel, success: false });
          continue;
        }

        const payload = {
          tipo:                'followup',
          timestamp:           new Date().toISOString(),
          followup_queue_id:   entry.id,
          followup_id:         entry.followup_id,
          meeting_followup_id: entry.meeting_followup_id,
          source_type:         entry.source_type,
          canal:               entry.channel,
          template_id:         entry.template_id,
          mensagem:            entry.message,
          assunto:             entry.subject,
          phone_number:        entry.phone_number ?? pessoa?.whatsapp ?? pessoa?.telefone ?? null,
          lead:                lead ?? null,
          pessoa:              pessoa ?? null,
        };

        for (const webhook of activeWebhooks) {
          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (webhook.headers && typeof webhook.headers === 'object') {
              Object.assign(headers, webhook.headers);
            }

            const res = await fetch(webhook.url, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            });

            const httpStatus = res.status;
            success = res.ok;
            if (!res.ok) errorMsg = `HTTP ${httpStatus}`;

            await supabase.from('webhook_logs').insert({
              webhook_id:    webhook.id,
              request_body:  payload,
              response_body: await res.text().catch(() => null),
              status_code:   httpStatus,
              error_message: errorMsg,
            });

          } catch (fetchErr) {
            errorMsg = fetchErr instanceof Error ? fetchErr.message : 'Erro de conexão';
            console.error(`[followup-trigger-worker] Erro ao chamar webhook:`, fetchErr);
          }
        }
      }

      // Atualizar status na fila
      await supabase
        .from('followup_queue')
        .update({
          status:        success ? 'queued' : 'failed',
          fired_at:      new Date().toISOString(),
          error_message: errorMsg,
          retry_count:   entry.retry_count + (success ? 0 : 1),
        })
        .eq('id', entry.id);

      results.push({ id: entry.id, lead_id: entry.lead_id, channel: entry.channel, success });
      console.log(`[followup-trigger-worker] Entry ${entry.id} (${entry.channel}): ${success ? 'dispatched' : 'failed'}`);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[followup-trigger-worker] Concluído: ${successCount}/${results.length} disparados`);

    return new Response(
      JSON.stringify({ processed: results.length, successful: successCount, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[followup-trigger-worker] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
