/**
 * Unit tests for kiwify-reconcile pure logic (KFY-1.6).
 *
 * Run: deno test supabase/functions/kiwify-reconcile/logic.test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { KiwifySale } from '../_shared/kiwify-client.ts';
import {
  formatDateYMD,
  isServiceRoleJwt,
  reconciliationWindow,
  saleStatusToTrigger,
  synthesizeEventPayload,
} from './logic.ts';

// ── saleStatusToTrigger ───────────────────────────────────────────────────────

Deno.test('saleStatusToTrigger maps terminal states to canonical triggers', () => {
  assertEquals(saleStatusToTrigger('paid', 'credit_card'), 'compra_aprovada');
  assertEquals(saleStatusToTrigger('approved', 'pix'), 'compra_aprovada');
  assertEquals(saleStatusToTrigger('authorized', 'credit_card'), 'compra_aprovada');
  assertEquals(saleStatusToTrigger('refunded', 'pix'), 'compra_reembolsada');
  assertEquals(saleStatusToTrigger('chargedback', 'credit_card'), 'chargeback');
  assertEquals(saleStatusToTrigger('refused', 'credit_card'), 'compra_recusada');
});

Deno.test('saleStatusToTrigger disambiguates waiting_payment by method', () => {
  assertEquals(saleStatusToTrigger('waiting_payment', 'pix'), 'pix_gerado');
  assertEquals(saleStatusToTrigger('waiting_payment', 'boleto'), 'boleto_gerado');
  assertEquals(saleStatusToTrigger('waiting_payment', 'credit_card'), null);
});

Deno.test('saleStatusToTrigger returns null for transient/unknown states', () => {
  for (const s of ['pending', 'processing', 'pending_refund', 'refund_requested', 'weird', '']) {
    assertEquals(saleStatusToTrigger(s, 'pix'), null);
  }
  assertEquals(saleStatusToTrigger(null, null), null);
});

Deno.test('saleStatusToTrigger is case-insensitive', () => {
  assertEquals(saleStatusToTrigger('PAID', 'PIX'), 'compra_aprovada');
  assertEquals(saleStatusToTrigger('Waiting_Payment', 'Boleto'), 'boleto_gerado');
});

// ── synthesizeEventPayload ────────────────────────────────────────────────────

const sale: KiwifySale = {
  id: 'ORD-abc',
  reference: 'REF1',
  status: 'paid',
  payment_method: 'pix',
  net_amount: 12048,
  currency: 'BRL',
  product: { id: 'PROD-1', name: 'Curso' },
  customer: { name: 'Fulano', email: 'f@x.com', mobile: '+5511999999999' },
  created_at: '2026-07-01T10:00:00Z',
  approved_date: '2026-07-01T10:05:00Z',
};

Deno.test('synthesizeEventPayload builds a parseable, reconcile-tagged payload', () => {
  const s = synthesizeEventPayload(sale, 'compra_aprovada');
  assertEquals(s.orderId, 'ORD-abc');
  assertEquals(s.dedupKey, 'ORD-abc');
  assertEquals(s.eventType, 'compra_aprovada');
  assertEquals(s.trigger, 'compra_aprovada');

  const raw = s.rawPayload;
  assertEquals(raw.order_id, 'ORD-abc');
  assertEquals(raw.webhook_event_type, 'compra_aprovada'); // resolveTrigger picks this directly
  assertEquals(raw.order_status, 'paid');
  assertEquals(raw.charge_amount, 12048); // falls back to net_amount
  assertEquals((raw.customer as { email: string }).email, 'f@x.com');
  assertEquals((raw.product as { id: string }).id, 'PROD-1');
  assertEquals((raw._reconcile as { source: string }).source, 'reconcile');
});

// ── date window ───────────────────────────────────────────────────────────────

Deno.test('formatDateYMD returns YYYY-MM-DD', () => {
  assertEquals(formatDateYMD(new Date('2026-07-02T23:59:59Z')), '2026-07-02');
});

Deno.test('reconciliationWindow clamps lookback to 1..90 days', () => {
  const now = new Date('2026-07-10T00:00:00Z');
  assertEquals(reconciliationWindow(now, 7).end, '2026-07-10');
  assertEquals(reconciliationWindow(now, 7).start, '2026-07-03');
  assertEquals(reconciliationWindow(now, 500).start, '2026-04-11'); // clamped to 90d
  assertEquals(reconciliationWindow(now, 0).start, '2026-07-09'); // clamped to 1d
});

// ── isServiceRoleJwt ──────────────────────────────────────────────────────────

function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

Deno.test('isServiceRoleJwt accepts a service_role JWT, rejects others', () => {
  assert(isServiceRoleJwt(makeJwt({ role: 'service_role', iss: 'supabase' })));
  assert(!isServiceRoleJwt(makeJwt({ role: 'authenticated' })));
  assert(!isServiceRoleJwt(makeJwt({ role: 'anon' })));
  assert(!isServiceRoleJwt(makeJwt({})));
});

Deno.test('isServiceRoleJwt rejects malformed input', () => {
  assert(!isServiceRoleJwt(null));
  assert(!isServiceRoleJwt(''));
  assert(!isServiceRoleJwt('not-a-jwt'));
  assert(!isServiceRoleJwt('only.two'));
  assert(!isServiceRoleJwt('a.b.c')); // undecodable payload
});
