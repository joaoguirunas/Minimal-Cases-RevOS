import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decideHumanAttribution, commissionValue, extractFirstSkuId } from './comercial-attribution.ts';

const paid = new Date('2026-09-20T12:00:00Z');
Deno.test('cupom do comercial vence tudo', () => {
  assertEquals(decideHumanAttribution({ couponCreatedBy: 'A', leadUserId: 'B', leadClaimedAt: '2026-09-19T00:00:00Z', paidAt: paid }), { recoveredBy: 'A', basis: 'cupom' });
});
Deno.test('sem cupom: dono dentro de 7d → janela; fora → nada', () => {
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: 'B', leadClaimedAt: '2026-09-14T12:00:01Z', paidAt: paid }), { recoveredBy: 'B', basis: 'janela' });
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: 'B', leadClaimedAt: '2026-09-12T11:59:59Z', paidAt: paid }), { recoveredBy: null, basis: null });
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: null, leadClaimedAt: null, paidAt: paid }), { recoveredBy: null, basis: null });
  assertEquals(decideHumanAttribution({ couponCreatedBy: null, leadUserId: 'B', leadClaimedAt: null, paidAt: paid }), { recoveredBy: null, basis: null });
});
Deno.test('commissionValue', () => {
  assertEquals(commissionValue(159.9, 3), 4.8);
  assertEquals(commissionValue(159.9, null), 0);
  assertEquals(commissionValue(null, 3), null);
});
Deno.test('extractFirstSkuId lê resource.items.data[0].sku.data.id', () => {
  assertEquals(extractFirstSkuId({ resource: { items: { data: [{ sku: { data: { id: 296095975 } } }] } } }), 296095975);
  assertEquals(extractFirstSkuId({ resource: { items: [] } }), null);
  assertEquals(extractFirstSkuId(null), null);
});
