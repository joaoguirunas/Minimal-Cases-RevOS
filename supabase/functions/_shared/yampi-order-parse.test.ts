// supabase/functions/_shared/yampi-order-parse.test.ts
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseYampiOrder, yampiDate } from './yampi-order-parse.ts';

const fixture = JSON.parse(await Deno.readTextFile(new URL('./fixtures/yampi-order-paid.json', import.meta.url)));

Deno.test('datas da Yampi viram ISO com -03:00', () => {
  assertEquals(new Date(yampiDate('2026-09-23 18:28:08.000000')!).toISOString(), '2026-09-23T21:28:08.000Z');
  assertEquals(new Date(yampiDate({ date: '2026-09-23 18:28:08.000000', timezone: 'America/Sao_Paulo' })!).toISOString(), '2026-09-23T21:28:08.000Z');
  assertEquals(yampiDate(null), null);
  assertEquals(yampiDate('lixo'), null);
});

Deno.test('pedido pago real: valores, pagamento, status e datas', () => {
  const p = parseYampiOrder(fixture)!;
  assert(p);
  assertEquals(p.order.id, fixture.id);
  assertEquals(p.order.status, 'paid');
  assertEquals(p.order.is_paid, true);
  assertEquals(p.order.value_total, Number(fixture.value_total));
  assertEquals(p.order.value_discount, Number(fixture.value_discount));
  assertEquals(p.order.payment_method, 'pix');
  assertEquals(p.order.state, fixture.shipping_address.data.uf);
  assertEquals(p.order.customer_email, 'cliente@teste.com');
  assert(p.order.paid_at && new Date(p.order.paid_at) >= new Date(p.order.created_at));
});

Deno.test('itens com produto, sku, variante e total', () => {
  const p = parseYampiOrder(fixture)!;
  assertEquals(p.items.length, fixture.items.data.length);
  const i = p.items[0];
  assertEquals(i.order_id, fixture.id);
  assertEquals(i.product_id, fixture.items.data[0].product_id);
  assertEquals(i.total, i.price * i.quantity);
  assert(i.variant && i.variant.includes('Preto'));
});

Deno.test('cancelado depois de pago: continua is_paid, status cancelled, cancelled_at', () => {
  const r = structuredClone(fixture);
  r.status = { data: { alias: 'cancelled' } };
  r.statuses.data.push({ alias: 'cancelled', created_at: { date: '2026-09-24 10:00:00.000000' } });
  const p = parseYampiOrder(r)!;
  assertEquals(p.order.status, 'cancelled');
  assertEquals(p.order.is_paid, true);
  assertEquals(new Date(p.order.cancelled_at!).toISOString(), '2026-09-24T13:00:00.000Z');
});

Deno.test('sem cliente e sem itens não quebra', () => {
  const r = structuredClone(fixture);
  delete r.customer; delete r.items;
  const p = parseYampiOrder(r)!;
  assertEquals(p.order.customer_email, null);
  assertEquals(p.items, []);
});

Deno.test('sem id → null', () => {
  assertEquals(parseYampiOrder({}), null);
});
