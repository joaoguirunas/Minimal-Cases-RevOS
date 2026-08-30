/**
 * AI-CALLBACK-WORKER — RETORNO-03
 *
 * POST /ai-callback-worker → invocado por pg_cron a cada minuto (RETORNO-06).
 *
 * Processa `ai_scheduled_callbacks` vencidos (retornos agendados pela tool
 * `agendar_retorno` do ai-agent-execute — RETORNO-02):
 *   1. Seleciona status='pending' AND scheduled_for <= now() (limit 50, ordem de vencimento).
 *   2. Claim atômico CAS pending → processing ANTES de qualquer efeito colateral.
 *   3. Guards (defesa em profundidade do ADR §D4): ai_enabled, lead won/lost,
 *      ai_processing_lock / message_buffer não processado.
 *   4. Janela de 24h do WhatsApp (§D6): fora dela só template aprovado; modo agent degrada.
 *   5. Disparo:
 *      - direct  → INSERT em messages(status='pending') + POST omni-delivery-engine;
 *      - template→ POST whatsapp-outbound (mesmo shape de iniciar_conversa_whatsapp);
 *      - agent   → POST ai-agent-execute { stage_trigger: true, direct_message }.
 *
 * Auth: pg_cron apresenta um JWT service_role (validado pelo gateway — deploy SEM
 * --no-verify-jwt, sem entrada verify_jwt=false no config.toml). Aqui só lemos a claim
 * `role`; NUNCA comparamos com SUPABASE_SERVICE_ROLE_KEY por string (rotation-proof).
 *
 * ADR: docs/smart-memory/decisions/ADR-RETORNO-01-agendar-retorno-arquitetura.md (D1, D5, D6).
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  AGENT_RETRY_MINUTES,
  BUSY_RETRY_MINUTES,
  buildAgentDirectMessage,
  computeRetry,
  decideDispatch,
  isServiceRoleJwt,
  resolveContent,
  type CallbackConfigRow,
  type CallbackRow,
} from './logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_LIMIT = 50;
const AGENT_TIMEOUT_MS = 45_000;
// QA RETORNO-07 [HIGH-2]: uma linha reivindicada (pending→processing) que crasha antes
// de terminar (deploy no meio do ciclo, worker sem timeout no fetch, limite de CPU) nunca
// mais é reconsiderada — a seleção só lê 'pending'. Reaper: processing "velho" volta a pending.
const STUCK_PROCESSING_MINUTES = 15;

interface RunResults {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  rescheduled: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const log = createLogger('ai-callback-worker');
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // ── Auth: exige JWT com role=service_role (rotation-proof) ──────────────────
  const bearer = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!isServiceRoleJwt(bearer)) {
    log.warn('unauthorized');
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);
  // ai_scheduled_callbacks / ai_agent_callback_configs são da RETORNO-01 e não estão
  // em types.ts → cast de fronteira (mesmo padrão das tabelas kiwify_*).
  const db = supabase as unknown as {
    from: (table: string) => any;
  };

  const results: RunResults = { processed: 0, sent: 0, skipped: 0, failed: 0, rescheduled: 0 };

  try {
    const nowIso = new Date().toISOString();

    // ── Reaper: reivindicações travadas em 'processing' voltam a 'pending' ──────
    // Roda ANTES da seleção de vencidos, pra uma linha destravada nesta mesma
    // invocação já poder ser reprocessada no mesmo ciclo.
    const stuckThreshold = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60_000).toISOString();
    const { data: reaped, error: reapErr } = await db
      .from('ai_scheduled_callbacks')
      .update({ status: 'pending', error_message: `reaper: processing travado > ${STUCK_PROCESSING_MINUTES}min` })
      .eq('status', 'processing')
      .lt('fired_at', stuckThreshold)
      .select('id');
    if (reapErr) {
      log.error('reaper_failed', { error: reapErr.message });
    } else if (reaped && reaped.length > 0) {
      log.warn('reaper_recovered', { count: reaped.length, ids: reaped.map((r: { id: string }) => r.id) });
    }

    const { data: due, error: dueErr } = await db
      .from('ai_scheduled_callbacks')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for')
      .limit(BATCH_LIMIT);

    if (dueErr) {
      log.error('queue_query_failed', { error: dueErr.message });
      return json({ ok: false, error: 'queue query failed' }, 500);
    }

    const queue = (due ?? []) as CallbackRow[];
    if (queue.length === 0) {
      log.info('nothing_due');
      return json({ ok: true, ...results });
    }

    log.info('queue_read', { due: queue.length });

    // Canal WhatsApp default — carregado uma vez por invocação.
    const { data: waChannel } = await supabase
      .from('settings_whatsapp_channels')
      .select('phone_number_id')
      .eq('is_default', true)
      .eq('active', true)
      .maybeSingle();
    const defaultWaPhoneNumberId: string | null = (waChannel as any)?.phone_number_id ?? null;

    const configCache = new Map<string, CallbackConfigRow | null>();

    for (const row of queue) {
      // ── 1. Claim atômico (CAS) — nada de efeito colateral antes disso ────────
      const { data: claimed, error: claimErr } = await db
        .from('ai_scheduled_callbacks')
        .update({ status: 'processing', fired_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'pending')
        .select('id');

      if (claimErr) {
        log.error('claim_failed', { callback_id: row.id, error: claimErr.message });
        continue;
      }
      if (!claimed || claimed.length === 0) {
        // Outra invocação do cron pegou esta linha primeiro.
        log.info('claim_lost', { callback_id: row.id });
        continue;
      }

      results.processed++;

      try {
        const outcome = await processCallback({
          db,
          supabase,
          supabaseUrl,
          serviceRoleKey,
          row,
          configCache,
          defaultWaPhoneNumberId,
          log,
        });
        results[outcome]++;
      } catch (e) {
        // Falha em uma linha NUNCA interrompe o loop (AC10).
        const msg = (e as Error).message;
        log.error('callback_unhandled_error', { callback_id: row.id, error: msg });
        await db
          .from('ai_scheduled_callbacks')
          .update({ status: 'failed', error_message: msg.slice(0, 500) })
          .eq('id', row.id);
        results.failed++;
      }
    }

    log.info('done', { ...results });
    return json({ ok: true, ...results });
  } catch (e) {
    log.error('worker_failed', { error: (e as Error).message });
    return json({ ok: false, error: 'internal error', ...results }, 500);
  }
});

type Outcome = 'sent' | 'skipped' | 'failed' | 'rescheduled';

interface ProcessDeps {
  db: { from: (table: string) => any };
  supabase: SupabaseClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  row: CallbackRow;
  configCache: Map<string, CallbackConfigRow | null>;
  defaultWaPhoneNumberId: string | null;
  log: ReturnType<typeof createLogger>;
}

async function processCallback(deps: ProcessDeps): Promise<Outcome> {
  const { db, supabase, supabaseUrl, serviceRoleKey, row, configCache, defaultWaPhoneNumberId, log } = deps;
  const now = new Date();

  const finish = async (patch: Record<string, unknown>, outcome: Outcome): Promise<Outcome> => {
    const { error } = await db.from('ai_scheduled_callbacks').update(patch).eq('id', row.id);
    if (error) log.error('status_update_failed', { callback_id: row.id, outcome, error: error.message });
    log.info('callback_done', { callback_id: row.id, mode: row.mode, outcome });
    return outcome;
  };

  /** Volta a linha para pending (reagendamento). Se outro pending nasceu para o mesmo
   *  lead enquanto processávamos, o índice único parcial rejeita → viramos skipped. */
  const reschedule = async (scheduledFor: string, retryCount: number, reason: string): Promise<Outcome> => {
    const { error } = await db
      .from('ai_scheduled_callbacks')
      .update({ status: 'pending', scheduled_for: scheduledFor, retry_count: retryCount, fired_at: null, error_message: reason })
      .eq('id', row.id);
    if (error) {
      log.warn('reschedule_rejected', { callback_id: row.id, error: error.message });
      return finish({ status: 'skipped', error_message: `reagendamento rejeitado: ${error.message.slice(0, 200)}` }, 'skipped');
    }
    log.info('callback_rescheduled', { callback_id: row.id, scheduled_for: scheduledFor, retry_count: retryCount, reason });
    return 'rescheduled';
  };

  // ── 2. Guards pré-disparo (ADR §D4) ───────────────────────────────────────
  const { data: person } = await supabase
    .from('clients_people')
    .select('id, whatsapp, ai_enabled, ai_processing_lock')
    .eq('id', row.people_id)
    .maybeSingle();

  if (!person) {
    return finish({ status: 'skipped', error_message: 'pessoa não encontrada' }, 'skipped');
  }
  if ((person as any).ai_enabled === false) {
    return finish({ status: 'skipped', error_message: 'human takeover' }, 'skipped');
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, status')
    .eq('id', row.lead_id)
    .maybeSingle();

  if (!lead) {
    return finish({ status: 'skipped', error_message: 'lead não encontrado' }, 'skipped');
  }
  const leadStatus = String((lead as any).status ?? '');
  if (leadStatus === 'won' || leadStatus === 'lost') {
    return finish({ status: 'skipped', error_message: `lead ${leadStatus}` }, 'skipped');
  }

  // Conversa em andamento neste exato instante → adia +2 min (máx. MAX_RETRIES).
  const { data: pendingBuffer } = await supabase
    .from('message_buffer')
    .select('id')
    .eq('people_id', row.people_id)
    .eq('processed', false)
    .limit(1);
  const conversationBusy =
    (person as any).ai_processing_lock === true || ((pendingBuffer ?? []) as unknown[]).length > 0;

  if (conversationBusy) {
    const retry = computeRetry(row.retry_count ?? 0, now, BUSY_RETRY_MINUTES, 'skipped');
    if (retry.status === 'pending') {
      return reschedule(retry.scheduledFor, retry.retryCount, 'conversa em andamento');
    }
    return finish({ status: 'skipped', retry_count: retry.retryCount, error_message: 'conversa em andamento após 3 tentativas' }, 'skipped');
  }

  // ── 3. Conteúdo + janela de 24h ───────────────────────────────────────────
  const config = await getConfig(db, configCache, row.agent_id, row.step_id, log);
  const content = resolveContent(row, config);

  // QA RETORNO-07 [HIGH-1]: sem filtro de channel, um inbound recente no Instagram
  // "renovava" a janela de 24h do WhatsApp (e vice-versa) — a janela é por canal.
  const { data: lastInbound } = await supabase
    .from('messages')
    .select('created_at')
    .eq('people_id', row.people_id)
    .eq('from_contact', 'cliente')
    .eq('channel', row.channel)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const decision = decideDispatch({
    channel: row.channel,
    mode: row.mode,
    lastInboundAt: (lastInbound as any)?.created_at ?? null,
    now,
    text: content.text,
    templateName: content.templateName,
  });

  log.info('dispatch_decided', { callback_id: row.id, mode: row.mode, channel: row.channel, kind: decision.kind });

  if (decision.kind === 'fail') {
    return finish({ status: 'failed', error_message: decision.error }, 'failed');
  }

  // ── 4a. Template aprovado (fora da janela de 24h) ─────────────────────────
  if (decision.kind === 'template') {
    const to = String((person as any).whatsapp ?? '').trim();
    if (!to) return finish({ status: 'failed', error_message: 'pessoa sem whatsapp para envio de template' }, 'failed');
    if (!defaultWaPhoneNumberId) {
      return finish({ status: 'failed', error_message: 'nenhum canal WhatsApp default ativo configurado' }, 'failed');
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-outbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        to,
        phone_number_id: defaultWaPhoneNumberId,
        people_id: row.people_id,
        lead_id: row.lead_id,
        messages: [{ type: 'template', template_name: decision.templateName }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return finish({
        status: 'failed',
        error_message: `whatsapp-outbound ${res.status}: ${body.slice(0, 300)}`,
      }, 'failed');
    }

    return finish({
      status: 'sent',
      error_message: null,
      response_data: {
        via: 'whatsapp-outbound',
        template_name: decision.templateName,
        ...(decision.degradedFrom ? { degraded_from: decision.degradedFrom } : {}),
      },
    }, 'sent');
  }

  // ── 4b. Modo agent (dentro da janela) ─────────────────────────────────────
  if (decision.kind === 'agent') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    let agentError: string | null = null;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-agent-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          people_id: row.people_id,
          stage_trigger: true,
          direct_message: buildAgentDirectMessage(row.reason, content.freePrompt),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        agentError = `ai-agent-execute ${res.status}: ${body.slice(0, 300)}`;
      } else {
        const body = await res.text().catch(() => '');
        clearTimeout(timer);
        // QA RETORNO-07 [MEDIUM]: ai-agent-execute responde HTTP 200 em vários
        // early-returns que NÃO enviam mensagem nenhuma (lock não adquirido, nada
        // a processar, IA desabilitada, agente não configurado, etc) — checar o
        // `status` do corpo antes de marcar como 'sent', não só o HTTP status.
        const NO_OP_STATUSES = new Set([
          'lock_not_acquired', 'nothing_to_process', 'ai_disabled_for_person',
          'no_agent_configured', 'score_matrix_not_matched', 'origem_lista_not_matched',
        ]);
        let parsedStatus: string | undefined;
        try { parsedStatus = JSON.parse(body)?.status; } catch { /* corpo não é JSON — segue como sent */ }

        if (parsedStatus && NO_OP_STATUSES.has(parsedStatus)) {
          agentError = `ai-agent-execute não enviou nada (status="${parsedStatus}")`;
        } else {
          return finish({
            status: 'sent',
            error_message: null,
            response_data: { via: 'ai-agent-execute', body: body.slice(0, 1000) },
          }, 'sent');
        }
      }
    } catch (e) {
      agentError = (e as Error).name === 'AbortError'
        ? `ai-agent-execute timeout após ${AGENT_TIMEOUT_MS}ms`
        : `ai-agent-execute erro: ${(e as Error).message}`;
    } finally {
      clearTimeout(timer);
    }

    const retry = computeRetry(row.retry_count ?? 0, now, AGENT_RETRY_MINUTES, 'failed');
    if (retry.status === 'pending') {
      return reschedule(retry.scheduledFor, retry.retryCount, agentError ?? 'falha no modo agent');
    }
    return finish({ status: 'failed', retry_count: retry.retryCount, error_message: agentError ?? 'falha no modo agent' }, 'failed');
  }

  // ── 4c. Modo direct dentro da janela — caminho canônico (passos 10 e 13) ──
  const insertRow: Record<string, unknown> = {
    people_id: row.people_id,
    lead_id: row.lead_id,
    content: decision.text,
    from_contact: 'agente_ia',
    // messages.source_type tem CHECK fechado (sem 'ai_callback') → origem vai no metadata (ADR §D5).
    source_type: 'ai_agent',
    channel: row.channel,
    status: 'pending',
    message_type: 'texto',
    metadata: { origin: 'ai_callback', callback_id: row.id },
  };
  if (row.channel === 'whatsapp' && defaultWaPhoneNumberId) {
    insertRow.wa_phone_number_id = defaultWaPhoneNumberId;
  }

  const { data: inserted, error: insErr } = await supabase
    .from('messages')
    .insert(insertRow)
    .select('id')
    .single();

  if (insErr) {
    return finish({ status: 'failed', error_message: `messages insert: ${insErr.message}` }, 'failed');
  }

  // Dispara o delivery engine (elimina a latência do cron de entrega).
  const deliveryRes = await fetch(`${supabaseUrl}/functions/v1/omni-delivery-engine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
    body: JSON.stringify({ people_id: row.people_id, trigger: 'ai_callback' }),
  }).catch((e) => {
    log.warn('delivery_engine_trigger_failed', { callback_id: row.id, error: (e as Error).message });
    return null;
  });

  return finish({
    status: 'sent',
    error_message: null,
    message_id: (inserted as any)?.id ?? null,
    response_data: {
      via: 'omni-delivery-engine',
      delivery_status: deliveryRes?.status ?? null,
    },
  }, 'sent');
}

/** Config do agente/step com fallback step_id IS NULL (armadilha use_stages — RETORNO-02). */
async function getConfig(
  db: { from: (table: string) => any },
  cache: Map<string, CallbackConfigRow | null>,
  agentId: string | null,
  stepId: string | null,
  log: ReturnType<typeof createLogger>,
): Promise<CallbackConfigRow | null> {
  if (!agentId) return null;
  const key = `${agentId}:${stepId ?? ''}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const { data, error } = await db
    .from('ai_agent_callback_configs')
    .select('*')
    .eq('agent_id', agentId);

  if (error) {
    log.error('config_load_failed', { agent_id: agentId, error: error.message });
    cache.set(key, null);
    return null;
  }

  const rows = (data ?? []) as CallbackConfigRow[];
  const chosen = (stepId ? rows.find(r => r.step_id === stepId) : undefined) ?? rows.find(r => r.step_id === null) ?? null;
  cache.set(key, chosen);
  return chosen;
}
