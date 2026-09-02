/**
 * YAMPI RECONCILE — YMP-4.2
 *
 * POST /yampi-reconcile → cron-invoked (pg_cron a cada 5 min via secure_http_post).
 *
 * Dois papéis:
 *   1. "Entrou no checkout": a Yampi NÃO tem webhook de checkout iniciado — o carrinho
 *      aparece em GET /checkout/carts assim que o cliente se identifica. Este worker
 *      lista os carrinhos recentes (janela deslizante) e sintetiza um evento
 *      `checkout_iniciado` por carrinho (idempotente: dedup_key = checkout:<cart_id>),
 *      que flui pelo MESMO caminho de um webhook real (yampi-process-event move o lead
 *      pro stage "Entrou no checkout" da esteira).
 *   2. Safety-net: reenfileira eventos presos em status='received' há mais de 10 min
 *      (dispatch do waitUntil perdido).
 *
 * O precedence guard do process-event impede regressão quando o cart.reminder ou o
 * pedido chegarem depois para o mesmo carrinho/pedido.
 *
 * Auth: exige JWT service_role (gateway valida a assinatura — deploy SEM
 * --no-verify-jwt); só a claim `role` é lida (rotation-proof, igual kiwify-reconcile).
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { createYampiClientForConnection, type YampiAbandonedCart } from '../_shared/yampi-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Janela de varredura (min). Sobreposição intencional — o dedup absorve repetidos. */
const LOOKBACK_MINUTES = 40;
/** Eventos 'received' mais velhos que isso são reenfileirados/drenados (inclui backfill). */
const STUCK_MINUTES = 1;
const MAX_CARTS_PER_RUN = 100;

/** Valida claim role=service_role sem comparar com a key (rotation-proof). */
export function isServiceRoleJwt(bearer: string | null | undefined): boolean {
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

function fmtYampiDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function cartHasIdentity(cart: YampiAbandonedCart): boolean {
  const email = cart.customer?.data?.email ?? cart.tracking_data?.email;
  const phone = cart.customer?.data?.phone?.full_number;
  return !!(email || phone);
}

async function invokeProcessEvent(
  supabaseUrl: string,
  serviceRoleKey: string,
  eventId: string,
): Promise<void> {
  await fetch(`${supabaseUrl}/functions/v1/yampi-process-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
    body: JSON.stringify({ event_id: eventId }),
  }).catch(() => { /* próximo tick reprocessa (safety-net) */ });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const log = createLogger('yampi-reconcile');
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const bearer = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!isServiceRoleJwt(bearer)) {
    log.warn('unauthorized');
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  const results = { carts_scanned: 0, checkouts_synthesized: 0, skipped_existing: 0, no_identity: 0, stuck_requeued: 0, errors: 0 };

  try {
    const bound = await createYampiClientForConnection(supabase);
    if (!bound) {
      return json({ ok: true, ...results, message: 'no connection configured' });
    }
    if (bound.row.status !== 'connected') {
      return json({ ok: true, ...results, message: `connection status=${bound.row.status}` });
    }

    // ── 1. Carrinhos recentes → checkout_iniciado ───────────────────────────
    // Filtro por data é diário na API; a janela fina é aplicada client-side via updated_at.
    const now = Date.now();
    const since = new Date(now - LOOKBACK_MINUTES * 60_000);
    const dateFilter = `updated_at:${fmtYampiDate(new Date(now - 24 * 3600_000))}|${fmtYampiDate(new Date(now))}`;

    let carts: YampiAbandonedCart[] = [];
    try {
      carts = await bound.client.listRecentCarts(dateFilter, MAX_CARTS_PER_RUN);
    } catch (e) {
      log.error('carts_list_failed', { error: (e as Error).message });
      results.errors++;
    }

    for (const cart of carts) {
      results.carts_scanned++;
      if (!cart.id) continue;

      // Janela fina client-side (quando a API retorna updated_at parseável).
      const updRaw = typeof cart.updated_at === 'string'
        ? cart.updated_at
        : (cart.updated_at as { date?: string } | null | undefined)?.date;
      if (updRaw) {
        const ts = Date.parse(String(updRaw).replace(' ', 'T'));
        if (Number.isFinite(ts) && ts < since.getTime()) continue;
      }

      if (!cartHasIdentity(cart)) {
        results.no_identity++;
        continue;
      }

      const dedupKey = `checkout:${cart.id}`;
      const { data: inserted, error: insertErr } = await supabase
        .from('yampi_webhook_events')
        .upsert({
          connection_id: bound.row.id,
          trigger: 'checkout_iniciado',
          event_type: 'cart.checkout_iniciado',
          cart_token: cart.token ?? null,
          dedup_key: dedupKey,
          raw_payload: {
            event: 'cart.checkout_iniciado',
            origin: 'reconcile',
            time: new Date().toISOString(),
            resource: cart,
          },
          signature_valid: true, // sintetizado internamente (não veio da rede)
          status: 'received',
        }, { onConflict: 'connection_id,event_type,dedup_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };

      if (insertErr) {
        results.errors++;
        log.error('checkout_event_insert_failed', { cart_id: cart.id, error: insertErr.message });
        continue;
      }
      if (!inserted) {
        results.skipped_existing++;
        continue;
      }
      results.checkouts_synthesized++;
      await invokeProcessEvent(supabaseUrl, serviceRoleKey, inserted.id);
    }

    // ── 2. Safety-net: eventos presos em 'received' ─────────────────────────
    const stuckBefore = new Date(now - STUCK_MINUTES * 60_000).toISOString();
    const { data: stuck } = await supabase
      .from('yampi_webhook_events')
      .select('id')
      .eq('status', 'received')
      .lt('created_at', stuckBefore)
      .order('created_at', { ascending: true })
      .limit(120);
    for (const row of (stuck ?? []) as Array<{ id: string }>) {
      results.stuck_requeued++;
      await invokeProcessEvent(supabaseUrl, serviceRoleKey, row.id);
    }

    log.info('reconcile_done', results);
    return json({ ok: true, ...results });
  } catch (e) {
    log.error('unhandled', { error: (e as Error).message });
    return json({ ok: false, error: (e as Error).message, ...results }, 500);
  }
});
