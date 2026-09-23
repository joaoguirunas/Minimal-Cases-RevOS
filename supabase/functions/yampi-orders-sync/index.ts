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
import { nextCursor, type Cursor } from '../_shared/orders-sync-cursor.ts';

const INCLUDE = 'items,transactions,statuses,customer,shipping_address,promocode';
const KEY = 'yampi_orders_backfill';

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

  // backfill
  const { data: st } = await sb.from('sync_state').select('value').eq('key', KEY).maybeSingle();
  let cursor: Cursor = (st?.value as Cursor) ?? { page: 1, done: false, total_pages: 0 };
  if (cursor.done) return Response.json({ ok: true, mode: 'backfill', done: true, page: cursor.page });
  let processed = 0;
  const pages = Math.max(1, Math.min(body.pages ?? 5, 20));
  for (let i = 0; i < pages && !cursor.done; i++) {
    try {
      const res = await get({ include: INCLUDE, limit: '100', page: String(cursor.page), orderBy: 'id', sortedBy: 'asc' });
      processed += await upsertYampiOrdersBatch(sb, (res.data ?? []) as any[], false);
      cursor = nextCursor(cursor, { processedPage: cursor.page, totalPages: Number(res.meta?.pagination?.total_pages ?? cursor.total_pages) });
    } catch (e) {
      cursor = nextCursor(cursor, null);
      await sb.from('sync_state').upsert({ key: KEY, value: cursor, updated_at: new Date().toISOString() });
      return Response.json({ ok: false, mode: 'backfill', page: cursor.page, error: String(e).slice(0, 300) });
    }
    await sb.from('sync_state').upsert({ key: KEY, value: cursor, updated_at: new Date().toISOString() });
  }
  return Response.json({ ok: true, mode: 'backfill', processed, page: cursor.page, done: cursor.done, total_pages: cursor.total_pages });
});
