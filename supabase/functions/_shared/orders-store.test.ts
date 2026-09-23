// supabase/functions/_shared/orders-store.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { upsertYampiOrder } from './orders-store.ts';

const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const fixture = JSON.parse(await Deno.readTextFile(new URL('./fixtures/yampi-order-paid.json', import.meta.url)));

Deno.test({ name: 'upsert duas vezes = 1 pedido, itens substituídos', ignore: !url || !key, fn: async () => {
  const sb = createClient(url!, key!);
  const r = { ...structuredClone(fixture), id: -999001 };
  r.items.data = r.items.data.map((i: any, n: number) => ({ ...i, id: -999100 - n }));
  await upsertYampiOrder(sb, r, { attribute: false });
  await upsertYampiOrder(sb, r, { attribute: false });
  const { count } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('id', -999001);
  const { count: itens } = await sb.from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', -999001);
  await sb.from('orders').delete().eq('id', -999001);
  assertEquals(count, 1);
  assertEquals(itens, r.items.data.length);
}});

Deno.test({ name: 'evento antigo não sobrescreve estado mais novo (cancelado não volta a pago)', ignore: !url || !key, fn: async () => {
  const sb = createClient(url!, key!);
  const novo = { ...structuredClone(fixture), id: -999002, status: { data: { alias: 'cancelled' } }, updated_at: { date: '2026-09-24 10:00:00.000000' } };
  novo.items.data = novo.items.data.map((i: any, n: number) => ({ ...i, id: -999200 - n }));
  const velho = { ...structuredClone(novo), status: { data: { alias: 'paid' } }, updated_at: { date: '2026-09-23 10:00:00.000000' } };
  await upsertYampiOrder(sb, novo, { attribute: false });
  await upsertYampiOrder(sb, velho, { attribute: false });
  const { data } = await sb.from('orders').select('status').eq('id', -999002).maybeSingle();
  await sb.from('orders').delete().eq('id', -999002);
  assertEquals((data as any)?.status, 'cancelled');
}});
