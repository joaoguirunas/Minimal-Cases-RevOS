// supabase/functions/yampi-orders-sync/index.ts
/**
 * yampi-orders-sync — carrega pedidos da Yampi em orders/order_items. Só GET na Yampi.
 *   { mode: 'backfill', pages?: 5 }  → continua do cursor em sync_state (100 pedidos/página)
 *   { mode: 'since', since?: ISO }   → pedidos atualizados desde X (padrão: 2 h atrás)
 * Chamado por cron (backfill a cada minuto até done; since de hora em hora). service_role.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createYampiClientForConnection } from '../_shared/yampi-client.ts';
import { upsertYampiOrdersBatch } from '../_shared/orders-store.ts';
import { nextMonthCursor, monthRange, type MonthCursor } from '../_shared/orders-sync-cursor.ts';

const INCLUDE = 'items,transactions,statuses,customer,shipping_address,promocode';
const KEY = 'yampi_orders_backfill';
/** Primeiro mês com pedidos na loja (histórico começa em jan/2025). */
const FIRST_MONTH = '2025-01';
const RKEY = 'yampi_orders_recompute';

/**
 * Depois da carga: 1º pedido + atribuição do histórico em lotes de 1.000, cada
 * tick do cron continua de onde parou. Só marca done quando um lote volta vazio;
 * erro não avança o cursor (o próximo tick tenta de novo).
 */
// deno-lint-ignore no-explicit-any
async function recomputeChunks(sb: any, chunks = 5) {
  const { data: st } = await sb.from('sync_state').select('value').eq('key', RKEY).maybeSingle();
  const state = ((st?.value as { last_id: number; done: boolean }) ?? { last_id: 0, done: false });
  for (let i = 0; i < chunks && !state.done; i++) {
    const { data, error } = await sb.rpc('recompute_attribution_chunk', { p_after: state.last_id, p_limit: 1000 });
    if (error) return { ...state, error: error.message };
    const last = Number(data ?? 0);
    if (!last) state.done = true; else state.last_id = last;
    await sb.from('sync_state').upsert({ key: RKEY, value: state, updated_at: new Date().toISOString() });
  }
  return state;
}

Deno.serve(async (req) => {
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // O gateway (verify_jwt) já validou a assinatura; aqui só exigimos o papel
  // service_role. Comparar com a env falhava: a chave do banco (_app_config,
  // usada pelo cron) e a da env podem ser de formatos diferentes.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let role = '';
  try { role = JSON.parse(atob(bearer.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role ?? ''; } catch (_) { /* não é JWT */ }
  if (role !== 'service_role' && bearer !== srk) return new Response('Forbidden', { status: 403 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, srk);
  const body = await req.json().catch(() => ({})) as { mode?: string; pages?: number; since?: string };
  const bound = await createYampiClientForConnection(sb);
  if (!bound) return Response.json({ ok: false, error: 'Yampi não conectada' });
  const get = (query: Record<string, string>) => bound.client.request<any>('GET', '/orders', { query } as never);

  if (body.mode === 'since') {
    const since = body.since ?? new Date(Date.now() - 2 * 3600_000).toISOString();
    let page = 1, processed = 0;
    for (;;) {
      const res = await get({ include: INCLUDE, limit: '100', page: String(page), orderBy: 'updated_at', sortedBy: 'desc' });
      const rows = (res.data ?? []) as any[];
      const fresh = rows.filter((o) => new Date(`${String(o.updated_at?.date ?? o.updated_at).replace(' ', 'T').replace(/\.\d+$/, '')}-03:00`) >= new Date(since));
      processed += await upsertYampiOrdersBatch(sb, fresh);
      if (fresh.length < rows.length || rows.length < 100 || page >= 20) break;
      page++;
    }
    return Response.json({ ok: true, mode: 'since', processed });
  }

  // backfill — mês a mês (a Yampi não pagina além de 10 mil nem filtra mais de 12 meses)
  const { data: st } = await sb.from('sync_state').select('value').eq('key', KEY).maybeSingle();
  const raw = st?.value as Partial<MonthCursor> | undefined;
  let cursor: MonthCursor = raw?.month ? (raw as MonthCursor) : { month: FIRST_MONTH, page: 1, done: false };
  if (cursor.done) return Response.json({ ok: true, mode: 'backfill', done: true, month: cursor.month, recompute: await recomputeChunks(sb) });
  const now = new Date();
  const currentMonth = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(now).slice(0, 7);
  let processed = 0;
  const pages = Math.max(1, Math.min(body.pages ?? 5, 20));
  for (let i = 0; i < pages && !cursor.done; i++) {
    try {
      const res = await get({ include: INCLUDE, limit: '100', page: String(cursor.page), date: monthRange(cursor.month) });
      processed += await upsertYampiOrdersBatch(sb, (res.data ?? []) as any[], false);
      cursor = nextMonthCursor(cursor, { processedPage: cursor.page, totalPages: Number(res.meta?.pagination?.total_pages ?? 0) }, currentMonth);
    } catch (e) {
      await sb.from('sync_state').upsert({ key: KEY, value: cursor, updated_at: new Date().toISOString() });
      return Response.json({ ok: false, mode: 'backfill', month: cursor.month, page: cursor.page, error: String(e).slice(0, 300) });
    }
    await sb.from('sync_state').upsert({ key: KEY, value: cursor, updated_at: new Date().toISOString() });
  }
  return Response.json({ ok: true, mode: 'backfill', processed, month: cursor.month, page: cursor.page, done: cursor.done });
});
