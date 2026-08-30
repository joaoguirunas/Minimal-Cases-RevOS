/**
 * KIWIFY RECONCILE — KFY-1.6
 *
 * POST /kiwify-reconcile  → cron-invoked (pg_cron every ~6h via secure_http_post).
 *
 * Detects Kiwify sales that never produced a webhook event (missed/lost deliveries) and
 * synthesizes the missing event so it flows through the SAME pipeline as a real webhook:
 *   1. List sales in a bounded window (<=90d, paginated) via KiwifyApiClient.listSales.
 *   2. For each sale with NO kiwify_webhook_events row for its order_id → synthesize an
 *      event (origin='reconcile'), insert idempotently, and invoke kiwify-process-event.
 *   3. process-event's own idempotency + precedence guard prevent duplicates/regressions
 *      if a real webhook later arrives for the same order.
 *
 * Auth: cron presents a service_role JWT (validated by the gateway — deploy WITHOUT
 * --no-verify-jwt). We only read the `role` claim; we do NOT string-compare against
 * SUPABASE_SERVICE_ROLE_KEY (rotation-proof — see kiwify-reconcile/logic.ts).
 *
 * Business logic (contact/lead/jobs) is NOT re-implemented here — it lives in
 * kiwify-process-event (KFY-1.5). This function only detects the gap and enqueues.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  createKiwifyClientForConnection,
  type KiwifyConnectionRow,
  type KiwifySale,
} from '../_shared/kiwify-client.ts';
import {
  isServiceRoleJwt,
  reconciliationWindow,
  saleStatusToTrigger,
  synthesizeEventPayload,
} from './logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap: up to 5000 sales per run
const DEFAULT_LOOKBACK_DAYS = 7;

interface ConnectionRow extends KiwifyConnectionRow {
  status: string;
}

async function invokeProcessEvent(
  supabaseUrl: string,
  serviceRoleKey: string,
  eventId: string,
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/functions/v1/kiwify-process-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
    body: JSON.stringify({ event_id: eventId }),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const log = createLogger('kiwify-reconcile');
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // ── Auth: require a service_role JWT (gateway-validated) ──────────────────────
  const bearer = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!isServiceRoleJwt(bearer)) {
    log.warn('unauthorized');
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  const results = { scanned: 0, synthesized: 0, skipped_existing: 0, unmapped: 0, errors: 0 };

  try {
    // ── Resolve the (single-tenant) connection ──────────────────────────────────
    const { data: conns } = await supabase
      .from('kiwify_connections')
      .select('id, account_id, client_id, client_secret_enc, access_token_enc, token_expires_at, status')
      .order('created_at', { ascending: false }) as unknown as { data: ConnectionRow[] | null };

    const conn = conns?.find((c) => c.status === 'connected') ?? conns?.[0];
    if (!conn) {
      log.info('no_connection');
      return json({ ok: true, ...results, message: 'no connection configured' });
    }

    const client = await createKiwifyClientForConnection(supabase, conn);

    // ── Reconciliation window ───────────────────────────────────────────────────
    const lookbackDays = Number(Deno.env.get('KIWIFY_RECONCILE_LOOKBACK_DAYS')) || DEFAULT_LOOKBACK_DAYS;
    const { start, end } = reconciliationWindow(new Date(), lookbackDays);

    // ── Paginate sales ──────────────────────────────────────────────────────────
    for (let page = 1; page <= MAX_PAGES; page++) {
      let batch: KiwifySale[];
      try {
        const resp = await client.listSales({
          start_date: start,
          end_date: end,
          page_size: PAGE_SIZE,
          page_number: page,
        });
        batch = resp.data ?? [];
      } catch (e) {
        log.error('list_sales_failed', { page, error: (e as Error).message });
        results.errors++;
        break;
      }

      if (batch.length === 0) break;

      for (const sale of batch) {
        results.scanned++;
        if (!sale.id) continue;

        const trigger = saleStatusToTrigger(sale.status, sale.payment_method);
        if (!trigger) {
          results.unmapped++;
          continue;
        }

        try {
          // Gap check: any existing event for this order_id means the webhook already
          // covered it (or a prior reconcile did) — skip to avoid double processing.
          const { data: existing } = await supabase
            .from('kiwify_webhook_events')
            .select('id')
            .eq('connection_id', conn.id)
            .eq('order_id', sale.id)
            .limit(1)
            .maybeSingle();

          if (existing) {
            results.skipped_existing++;
            continue;
          }

          const synth = synthesizeEventPayload(sale, trigger);

          const { data: inserted, error: insErr } = await supabase
            .from('kiwify_webhook_events')
            .upsert({
              connection_id: conn.id,
              trigger: synth.trigger,
              event_type: synth.eventType,
              order_id: synth.orderId,
              subscription_id: null,
              dedup_key: synth.dedupKey,
              raw_payload: synth.rawPayload,
              signature_valid: false,
              status: 'received',
            }, { onConflict: 'connection_id,event_type,dedup_key', ignoreDuplicates: true })
            .select('id')
            .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };

          if (insErr) {
            log.error('event_insert_failed', { order_id: sale.id, error: insErr.message });
            results.errors++;
            continue;
          }

          // Null = concurrent reconcile already inserted it → nothing to enqueue.
          if (!inserted) {
            results.skipped_existing++;
            continue;
          }

          const ok = await invokeProcessEvent(supabaseUrl, serviceRoleKey, inserted.id);
          if (ok) {
            results.synthesized++;
            log.info('event_synthesized', { event_id: inserted.id, order_id: sale.id, trigger });
          } else {
            results.errors++;
            log.warn('process_event_non_ok', { event_id: inserted.id, order_id: sale.id });
          }
        } catch (e) {
          results.errors++;
          log.error('sale_reconcile_failed', { order_id: sale.id, error: (e as Error).message });
        }
      }

      if (batch.length < PAGE_SIZE) break;
    }

    log.info('reconcile_done', { ...results, window: `${start}..${end}` });
    return json({ ok: true, ...results, window: { start, end } });
  } catch (e) {
    log.error('unhandled', { error: (e as Error).message });
    return json({ ok: false, error: 'internal error', ...results }, 500);
  }
});
