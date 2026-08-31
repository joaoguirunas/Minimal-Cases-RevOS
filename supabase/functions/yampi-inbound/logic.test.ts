/**
 * Unit tests — yampi-inbound pure logic (YMP-1.3).
 * Run: deno test supabase/functions/yampi-inbound/logic.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  deriveEvent,
  deriveTrigger,
  extractContact,
  hmacSha256Base64,
  verifySignature,
} from './logic.ts';

// ── Signature ─────────────────────────────────────────────────────────────────

Deno.test('verifySignature accepts a matching base64 HMAC-SHA256', async () => {
  const body = '{"event":"cart.reminder","resource":{"id":1}}';
  const secret = 'a'.repeat(40);
  const sig = await hmacSha256Base64(body, secret);
  assertEquals(await verifySignature(body, sig, secret), true);
});

Deno.test('verifySignature rejects wrong signature / missing secret', async () => {
  const body = '{"event":"cart.reminder"}';
  assertEquals(await verifySignature(body, 'bm90LXZhbGlk', 'secret'), false);
  assertEquals(await verifySignature(body, null, 'secret'), false);
  assertEquals(await verifySignature(body, 'whatever', null), false);
});

// ── Trigger derivation ────────────────────────────────────────────────────────

Deno.test('deriveTrigger maps cart.reminder → carrinho_abandonado', () => {
  assertEquals(deriveTrigger('cart.reminder', {}), 'carrinho_abandonado');
});

Deno.test('deriveTrigger splits order.created by payment alias', () => {
  assertEquals(deriveTrigger('order.created', { payments: [{ alias: 'pix' }] }), 'pix_gerado');
  assertEquals(deriveTrigger('order.created', { payments: [{ alias: 'billet' }] }), 'boleto_gerado');
  assertEquals(deriveTrigger('order.created', { payments: [{ alias: 'credit_card' }] }), 'pedido_criado');
  assertEquals(deriveTrigger('order.created', {}), 'pedido_criado');
});

Deno.test('deriveTrigger maps order lifecycle events', () => {
  assertEquals(deriveTrigger('order.paid', {}), 'pedido_pago');
  assertEquals(deriveTrigger('order.status.updated', { status: { data: { alias: 'cancelled' } } }), 'pedido_cancelado');
  assertEquals(deriveTrigger('order.status.updated', { status: { data: { alias: 'paid' } } }), 'pedido_pago');
  assertEquals(deriveTrigger('order.status.updated', { status: { data: { alias: 'handling_products' } } }), 'pedido_status_atualizado');
  assertEquals(deriveTrigger('transaction.payment.refused', {}), 'pagamento_recusado');
  assertEquals(deriveTrigger('product.updated', {}), null);
});

// ── deriveEvent ───────────────────────────────────────────────────────────────

Deno.test('deriveEvent extracts cart token for cart events and order id otherwise', () => {
  const cartBody = JSON.stringify({
    event: 'cart.reminder',
    resource: { id: 111, token: 'tok-abc', abandoned_step: 'shippment' },
  });
  const cart = deriveEvent(JSON.parse(cartBody), cartBody);
  assertEquals(cart.trigger, 'carrinho_abandonado');
  assertEquals(cart.cartToken, 'tok-abc');
  assertEquals(cart.orderId, null);

  const orderBody = JSON.stringify({
    event: 'order.paid',
    resource: { id: 1000001 },
  });
  const order = deriveEvent(JSON.parse(orderBody), orderBody);
  assertEquals(order.trigger, 'pedido_pago');
  assertEquals(order.orderId, '1000001');
  assertEquals(order.cartToken, null);
});

Deno.test('deriveEvent dedup is stable for identical bodies, distinct otherwise', () => {
  const body1 = JSON.stringify({ event: 'cart.reminder', time: '10:00', resource: { id: 5 } });
  const body2 = JSON.stringify({ event: 'cart.reminder', time: '11:00', resource: { id: 5 } });
  const a = deriveEvent(JSON.parse(body1), body1);
  const b = deriveEvent(JSON.parse(body1), body1);
  const c = deriveEvent(JSON.parse(body2), body2);
  assertEquals(a.dedupKey, b.dedupKey);
  assertEquals(a.dedupKey === c.dedupKey, false);
});

// ── Contact extraction ────────────────────────────────────────────────────────

Deno.test('extractContact reads customer.data with phone.full_number', () => {
  const contact = extractContact({
    resource: {
      customer: {
        data: {
          id: 789,
          name: 'Gabriella Souza',
          email: 'Gabi@Example.com',
          phone: { full_number: '16991234567' },
        },
      },
    },
  });
  assertEquals(contact.name, 'Gabriella Souza');
  assertEquals(contact.email, 'gabi@example.com');
  assertEquals(contact.phone, '16991234567');
  assertEquals(contact.customerId, '789');
});

Deno.test('extractContact falls back to tracking_data when no customer linked', () => {
  const contact = extractContact({
    resource: { tracking_data: { name: 'João Silva', email: 'joao@example.com' } },
  });
  assertEquals(contact.name, 'João Silva');
  assertEquals(contact.email, 'joao@example.com');
  assertEquals(contact.phone, null);
  assertEquals(contact.customerId, null);
});
