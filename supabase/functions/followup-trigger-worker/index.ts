import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmailWithConfig,
  hasDirectEmailProvider,
  type EmailConfig,
} from "../_shared/email-provider.ts";
import { hasDirectSmsProvider, sendSmsWithConfig, type SmsConfig } from "../_shared/sms-provider.ts";
import { createTrackedLink, resolveCartForPerson, formatBRL } from "../_shared/tracked-links.ts";
import { progressEsteiraStage } from "../_shared/esteira-progress.ts";

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

// ── Guarda de estoque (Yampi GET /catalog/skus/{id}) — cache por invocação ──────
const skuStockCache = new Map<number, boolean>();
async function isSkuSoldOut(supabase: ReturnType<typeof createClient>, skuId: number): Promise<boolean> {
  if (skuStockCache.has(skuId)) return skuStockCache.get(skuId)!;
  let soldOut = false;
  try {
    const { createYampiClientForConnection } = await import('../_shared/yampi-client.ts');
    const bound = await createYampiClientForConnection(supabase as never);
    if (bound) {
      const res = await bound.client.request<{ data?: { blocked_sale?: boolean; total_in_stock?: number; quantity_managed?: boolean; stock_status?: string } }>('GET', `/catalog/skus/${skuId}`);
      const sk = res.data ?? (res as unknown as { blocked_sale?: boolean; total_in_stock?: number; quantity_managed?: boolean; stock_status?: string });
      soldOut = sk.blocked_sale === true || (sk.quantity_managed !== false && (sk.stock_status === 'out_of_stock' || sk.total_in_stock === 0));
    }
  } catch (_) { /* API indisponível → não bloqueia o envio */ }
  skuStockCache.set(skuId, soldOut);
  return soldOut;
}

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

    // Config do canal SMS (KLV-1): com provider direto (twilio/klaviyo) ativo,
    // follow-ups de SMS saem por ele; senão caem no fallback de webhook (legado).
    let smsConfig: SmsConfig | null = null;
    {
      const { data: smsRow } = await supabase
        .from('omni_channel_configs')
        .select('is_active, credentials')
        .eq('channel', 'sms')
        .maybeSingle();
      smsConfig = (smsRow as SmsConfig | null) ?? null;
    }
    const smsProviderActive =
      !!smsConfig?.is_active && hasDirectSmsProvider(smsConfig?.credentials);

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
            .select('name, json_data, status')
            .eq('id_template', entry.template_id)
            .maybeSingle();
          // Template ainda não aprovado pela Meta → não tenta (a Meta rejeitaria).
          const templateNotApproved = !!tplRow?.status && !['approved', 'APPROVED'].includes(String(tplRow.status));

          const resolvedTemplateName = tplRow?.name ?? entry.template_id;

          type TplComponent = { type: string; format?: string; text?: string };
          const tplComponents: TplComponent[] =
            ((tplRow?.json_data as Record<string, unknown>)?.components as TplComponent[]) ?? [];

          const headerComp = tplComponents.find(
            (c) => c.type === 'HEADER' && c.format === 'TEXT' && c.text?.includes('{{'),
          );
          // Extract param name/index from the header variable: {{nome}} → 'nome', {{1}} → '1'
          const headerParamName = headerComp?.text?.match(/\{\{([^}]+)\}\}/)?.[1] ?? null;

          const msgComponents: Array<Record<string, unknown>> = headerParamName
            ? [{ type: 'header', parameters: [{ type: 'text', text: '', parameter_name: headerParamName }] }]
            : [];

          // ── Esteira (EST-WA): body {{1..n}} + botão URL rastreado a partir de rule.vars ──
          // vars.wa_params = ["nome","remetente","produto","modelo_celular","expira_em",...]
          // vars.wa_button_url = true → botão URL com sufixo dinâmico = token do link rastreado.
          if (entry.followup_id) {
            const { data: waRule } = await supabase
              .from('leads_stages_followups')
              .select('vars')
              .eq('id', entry.followup_id)
              .maybeSingle();
            const rv = ((waRule as { vars?: Record<string, unknown> } | null)?.vars ?? {}) as Record<string, unknown>;
            const waParams = Array.isArray(rv.wa_params) ? (rv.wa_params as string[]) : [];
            if (waParams.length > 0 || rv.wa_button_url) {
              const waCart = entry.person_id ? await resolveCartForPerson(supabase, entry.person_id) : null;
              const eCredsWa = (emailConfig?.credentials ?? {}) as Record<string, string>;
              const expiraH = Number(rv.expira_horas ?? '24') || 24;
              const expiraWa = new Date(Date.now() + expiraH * 3_600_000)
                .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
              const waVars: Record<string, string> = {
                nome: (pessoa?.name ?? '').split(/\s+/)[0] || 'cliente',
                remetente: eCredsWa.sender_name || eCredsWa.from_name || 'Minimal Cases',
                produto: waCart?.produto ?? 'sua case Minimal',
                modelo_celular: waCart?.modeloCelular ?? 'seu celular',
                preco: formatBRL(waCart?.total ?? null),
                cupom: String(rv.cupom ?? ''),
                expira_em: expiraWa,
              };
              if (waParams.length > 0) {
                msgComponents.push({
                  type: 'body',
                  parameters: waParams.map((k) => ({ type: 'text', text: waVars[k] ?? String(rv[k] ?? '') })),
                });
              }
              if (rv.wa_button_url && waCart?.url && entry.person_id) {
                const trackedWa = await createTrackedLink(supabase, {
                  destination: waCart.url, peopleId: entry.person_id, leadId: entry.lead_id, channel: 'whatsapp',
                });
                const tokenWa = trackedWa?.match(/[?&]t=([A-Za-z0-9]+)/)?.[1];
                if (tokenWa) {
                  msgComponents.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: tokenWa }] });
                }
              }
            }
          }

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

          if (templateNotApproved) {
            errorMsg = `Template WhatsApp "${resolvedTemplateName}" ainda não aprovado pela Meta (status ${tplRow?.status})`;
            console.warn(`[followup-trigger-worker] Entry ${entry.id}: ${errorMsg}`);
          } else try {
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

          let ruleVars: Record<string, string> = {};
          if (entry.followup_id) {
            const { data: rule } = await supabase
              .from('leads_stages_followups')
              .select('email_template_id, vars')
              .eq('id', entry.followup_id)
              .maybeSingle();
            // Vars estáticas da regra (ex.: {"cupom":"VOLTA10","cupom_pct":"10"}).
            const rv = (rule as { vars?: Record<string, unknown> } | null)?.vars;
            if (rv && typeof rv === 'object') {
              ruleVars = Object.fromEntries(Object.entries(rv).map(([k, v]) => [k, String(v ?? '')]));
            }

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
            // {{nome}} = primeiro nome; {{asset_base}} = base pública das imagens —
            // configurável na UI (credentials.asset_base do canal e-mail); fallback
            // env EMAIL_ASSET_BASE e por fim o bucket público email-assets.
            'nome': (pessoa?.name ?? '').split(/\s+/)[0] ?? '',
            'asset_base': (emailConfig?.credentials as Record<string, string> | null | undefined)?.asset_base
              || Deno.env.get('EMAIL_ASSET_BASE')
              || `${(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')}/storage/v1/object/public/email-assets`,
          };

          // ── Personalização da esteira (EST-VARS): produto, modelo, preço, cupom… ──
          // Tudo que os templates da proposta usam, montado a partir do carrinho
          // Yampi/Zoppy da pessoa + credenciais do canal + vars da regra.
          const eCreds = (emailConfig?.credentials ?? {}) as Record<string, string>;
          const cart = entry.person_id ? await resolveCartForPerson(supabase, entry.person_id) : null;
          const cupomPct = Number(ruleVars.cupom_pct ?? '0') || 0;
          const total = cart?.total ?? null;
          const expira = new Date(Date.now() + (Number(ruleVars.expira_horas ?? '24') || 24) * 3_600_000);
          const expiraFmt = expira.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
          Object.assign(vars, {
            'produto': cart?.produto ?? 'sua case Minimal',
            'modelo_celular': cart?.modeloCelular ?? 'seu celular',
            'modelo_celular_curto': cart?.modeloCelularCurto ?? cart?.modeloCelular ?? 'seu celular',
            'imagem_produto': cart?.imagemProduto ?? `${vars['asset_base']}/prod-fosca.jpg`,
            'preco': formatBRL(total),
            'total': formatBRL(total),
            'preco_com_cupom': formatBRL(total !== null && cupomPct > 0 ? total * (1 - cupomPct / 100) : total),
            'cupom': ruleVars.cupom ?? '',
            'etapa_abandono': cart?.etapaAbandono === 'personal_info' ? 'cadastro' : cart?.etapaAbandono === 'shippment' ? 'frete' : cart?.etapaAbandono === 'payment' ? 'pagamento' : '',
            'expira_em': expiraFmt,
            'countdown_gif': `${vars['asset_base']}/countdown-placeholder.png`,
            'remetente': eCreds.sender_name || eCreds.from_name || 'Minimal Cases',
            'cargo': eCreds.sender_role || 'Atendimento & Experiência',
            'link_whatsapp': eCreds.link_whatsapp || 'https://minimalcases.com.br/',
            'unsubscribe': eCreds.unsubscribe_url || (eCreds.from_email ? `mailto:${eCreds.from_email}?subject=Descadastro` : 'https://minimalcases.com.br/'),
          }, ruleVars);

          // {{link_checkout}} → link do carrinho da pessoa, RASTREADO (BI-REC-3):
          // clique registrado em tracked_links vira evidência de atribuição.
          if ((html.includes('{{link_checkout}}') || subject.includes('{{link_checkout}}')) && entry.person_id) {
            const cartUrl = cart?.url ?? null;
            if (cartUrl) {
              const tracked = await createTrackedLink(supabase, {
                destination: cartUrl,
                peopleId: entry.person_id,
                leadId: entry.lead_id,
                channel: 'email',
              });
              vars['link_checkout'] = tracked ?? cartUrl;
            }
          }

          // Guarda de estoque (Yampi): produto esgotado/bloqueado → não manda "sua case
          // está esperando"; cancela os toques restantes desse lead com motivo claro.
          const soldOut = cart?.skuId ? await isSkuSoldOut(supabase, cart.skuId) : false;
          if (soldOut) {
            await supabase.from('followup_queue').update({ status: 'cancelled', error_message: 'auto-cancel: produto esgotado/indisponível na loja' })
              .eq('lead_id', entry.lead_id).eq('status', 'pending');
            errorMsg = 'Produto do carrinho esgotado/indisponível — toques cancelados';
            console.warn(`[followup-trigger-worker] Entry ${entry.id}: ${errorMsg}`);
          }
          const result = soldOut ? { success: false, error: errorMsg ?? '' } : await sendEmailWithConfig(emailConfig!, { to: toEmail, subject, html, vars });
          success = result.success;
          if (!result.success) {
            errorMsg = result.error ?? 'Falha no envio de e-mail';
            console.warn(`[followup-trigger-worker] Entry ${entry.id} (email): ${errorMsg}`);
          }
        }

      // ── sms: envio direto via provider configurado (Twilio/Klaviyo) ──────
      } else if (entry.channel === 'sms' && smsProviderActive) {
        const toPhone = entry.phone_number ?? pessoa?.whatsapp ?? pessoa?.telefone ?? null;
        if (!toPhone) {
          errorMsg = 'Sem telefone disponível para envio de SMS';
          console.warn(`[followup-trigger-worker] Entry ${entry.id}: ${errorMsg}`);
        } else {
          const smsVars: Record<string, string> = {
            'pessoa.nome': pessoa?.name ?? '',
            'pessoa.email': pessoa?.email ?? '',
            'pessoa.telefone': pessoa?.telefone ?? '',
            'pessoa.whatsapp': pessoa?.whatsapp ?? '',
            'lead.titulo': lead?.title ?? '',
            'nome': (pessoa?.name ?? '').split(/\s+/)[0] ?? '',
          };

          const smsCart = entry.person_id ? await resolveCartForPerson(supabase, entry.person_id) : null;
          smsVars['produto'] = smsCart?.produto ?? 'sua case Minimal';
          smsVars['modelo_celular'] = smsCart?.modeloCelular ?? 'seu celular';
          if ((entry.message ?? '').includes('{{link_checkout}}') && entry.person_id) {
            const cartUrl = smsCart?.url ?? null;
            if (cartUrl) {
              const tracked = await createTrackedLink(supabase, {
                destination: cartUrl,
                peopleId: entry.person_id,
                leadId: entry.lead_id,
                channel: 'sms',
              });
              smsVars['link_checkout'] = tracked ?? cartUrl;
            }
          }
          const result = await sendSmsWithConfig(smsConfig!, {
            to: toPhone,
            message: entry.message ?? '',
            vars: smsVars,
          });
          success = result.success;
          if (!result.success) {
            errorMsg = result.error ?? 'Falha no envio de SMS';
            console.warn(`[followup-trigger-worker] Entry ${entry.id} (sms): ${errorMsg}`);
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

      // Progressão da esteira (YMP-7): 1º toque enviado avança o lead para o
      // stage "Em recuperação" do pipeline dele (forward-only; no-op se o
      // pipeline não tem esse stage ou o lead já passou dele).
      if (success && entry.source_type === 'stage' && entry.lead_id) {
        try {
          await progressEsteiraStage(supabase, entry.lead_id, 'Em recuperação');
        } catch (_) { /* progressão nunca falha o disparo */ }
      }

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
