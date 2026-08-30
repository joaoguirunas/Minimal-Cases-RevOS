/**
 * Unit tests for kiwify-inbound pure logic (KFY-1.4).
 *
 * Run: deno test supabase/functions/kiwify-inbound/logic.test.ts
 *
 * Covers the two load-bearing behaviors of the receiver:
 *   - signature verification (HMAC-SHA1 hex, constant-time) against a known vector
 *   - dedup_key derivation per trigger class (order / subscription / cart / fallback)
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  constantTimeEqual,
  deriveEvent,
  hmacSha1Hex,
  md5Hex,
  verifySignature,
} from './logic.ts';

// ── Signature ─────────────────────────────────────────────────────────────────

Deno.test('hmacSha1Hex matches known RFC-2202 test vector', async () => {
  // HMAC-SHA1(key="Jefe", data="what do ya want for nothing?")
  const hex = await hmacSha1Hex('what do ya want for nothing?', 'Jefe');
  assertEquals(hex, 'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79');
});

Deno.test('constantTimeEqual is correct for equal / unequal / length-mismatch', () => {
  assert(constantTimeEqual('abc123', 'abc123'));
  assert(!constantTimeEqual('abc123', 'abc124'));
  assert(!constantTimeEqual('abc', 'abcd'));
  assert(!constantTimeEqual('', 'x'));
  assert(constantTimeEqual('', ''));
});

Deno.test('verifySignature accepts a valid signature and is case-insensitive on hex', async () => {
  const body = '{"order_id":"ORD-1","webhook_event_type":"compra_aprovada"}';
  const token = 'wh_secret_token';
  const sig = await hmacSha1Hex(body, token);
  assert(await verifySignature(body, sig, token));
  assert(await verifySignature(body, sig.toUpperCase(), token));
});

Deno.test('verifySignature rejects wrong token, tampered body, and missing inputs', async () => {
  const body = '{"order_id":"ORD-1"}';
  const token = 'wh_secret_token';
  const sig = await hmacSha1Hex(body, token);

  assert(!await verifySignature(body, sig, 'other_token'));
  assert(!await verifySignature('{"order_id":"ORD-2"}', sig, token));
  assert(!await verifySignature(body, null, token)); // no signature param
  assert(!await verifySignature(body, sig, null)); // no token
});

// ── dedup_key derivation ──────────────────────────────────────────────────────

Deno.test('order events use order_id as dedup_key; event_type preserved raw', () => {
  const payload = { order_id: 'ORD-100', webhook_event_type: 'compra_aprovada', order_status: 'paid' };
  const d = deriveEvent(payload, JSON.stringify(payload));
  assertEquals(d.dedupKey, 'ORD-100');
  assertEquals(d.orderId, 'ORD-100');
  assertEquals(d.eventType, 'compra_aprovada');
  assertEquals(d.trigger, 'compra_aprovada');
});

Deno.test('same order_id with different event_type yields different dedup identity', () => {
  const pix = { order_id: 'ORD-1', webhook_event_type: 'pix_gerado' };
  const paid = { order_id: 'ORD-1', webhook_event_type: 'compra_aprovada' };
  const dPix = deriveEvent(pix, JSON.stringify(pix));
  const dPaid = deriveEvent(paid, JSON.stringify(paid));
  // Same dedup_key but the UNIQUE(connection_id, event_type, dedup_key) index makes them
  // distinct rows — the pipeline transition pix→paid is preserved, not deduped away.
  assertEquals(dPix.dedupKey, dPaid.dedupKey);
  assert(dPix.eventType !== dPaid.eventType);
});

Deno.test('event_type alias maps to config trigger (best-effort)', () => {
  const payload = { order_id: 'ORD-2', webhook_event_type: 'order_approved' };
  const d = deriveEvent(payload, JSON.stringify(payload));
  assertEquals(d.trigger, 'compra_aprovada');
  assertEquals(d.eventType, 'order_approved');
});

Deno.test('subscription events key on subscription_id + charge date', () => {
  const renew1 = {
    webhook_event_type: 'subscription_renewed',
    subscription: { id: 'SUB-9', charge_date: '2026-07-01' },
  };
  const renew2 = {
    webhook_event_type: 'subscription_renewed',
    subscription: { id: 'SUB-9', charge_date: '2026-08-01' },
  };
  const d1 = deriveEvent(renew1, JSON.stringify(renew1));
  const d2 = deriveEvent(renew2, JSON.stringify(renew2));
  assertEquals(d1.subscriptionId, 'SUB-9');
  assertEquals(d1.dedupKey, 'SUB-9|2026-07-01');
  // Consecutive renewals of the same subscription must NOT collide.
  assert(d1.dedupKey !== d2.dedupKey);
});

Deno.test('carrinho_abandonado (no order_id) keys on md5(email|product|checkout)', () => {
  const payload = {
    webhook_event_type: 'carrinho_abandonado',
    Customer: { email: 'a@b.com' },
    Product: { product_id: 'PROD-7' },
    checkout_id: 'CHK-5',
  };
  const d = deriveEvent(payload, JSON.stringify(payload));
  assertEquals(d.orderId, null);
  assertEquals(d.trigger, 'carrinho_abandonado');
  assertEquals(d.dedupKey, md5Hex('a@b.com|PROD-7|CHK-5'));
});

Deno.test('carrinho_abandonado falls back to md5(email|product) when checkout id absent', () => {
  const payload = {
    webhook_event_type: 'carrinho_abandonado',
    customer: { email: 'x@y.com' },
    product: { id: 'PROD-1' },
  };
  const d = deriveEvent(payload, JSON.stringify(payload));
  assertEquals(d.dedupKey, md5Hex('x@y.com|PROD-1|'));
});

Deno.test('unidentifiable payload falls back to md5(rawBody) for retry dedup', () => {
  const payload = { something: 'else' };
  const raw = JSON.stringify(payload);
  const d = deriveEvent(payload, raw);
  assertEquals(d.dedupKey, md5Hex(raw));
  assertEquals(d.eventType, 'unknown');
  assertEquals(d.trigger, null);
});
