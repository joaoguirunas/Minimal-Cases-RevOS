/**
 * Unit tests — yampi-events pure helpers (YMP-4).
 * Run: deno test supabase/functions/_shared/yampi-events.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  guardScope,
  parseYampiPayload,
  PRECEDENCE_RANK,
  rankOf,
  shouldProceed,
} from './yampi-events.ts';

Deno.test('precedence ranks follow the funnel order', () => {
  assertEquals(PRECEDENCE_RANK.checkout_iniciado < PRECEDENCE_RANK.carrinho_abandonado, true);
  assertEquals(PRECEDENCE_RANK.carrinho_abandonado < PRECEDENCE_RANK.pix_gerado, true);
  assertEquals(PRECEDENCE_RANK.pix_gerado < PRECEDENCE_RANK.pagamento_recusado, true);
  assertEquals(PRECEDENCE_RANK.pagamento_recusado < PRECEDENCE_RANK.pedido_pago, true);
  assertEquals(PRECEDENCE_RANK.pedido_pago < PRECEDENCE_RANK.pedido_cancelado, true);
});

Deno.test('shouldProceed: advances, blocks regressions, ties by timestamp', () => {
  assertEquals(shouldProceed(rankOf('pedido_pago'), 2, rankOf('pix_gerado'), 1), true);
  assertEquals(shouldProceed(rankOf('checkout_iniciado'), 9, rankOf('pedido_pago'), 1), false);
  assertEquals(shouldProceed(rankOf('pix_gerado'), 2, rankOf('pix_gerado'), 1), true);
  assertEquals(shouldProceed(rankOf('pix_gerado'), 1, rankOf('pix_gerado'), 2), false);
  assertEquals(shouldProceed(rankOf('carrinho_abandonado'), null, null, null), true);
});

Deno.test('guardScope prefers order_id, falls back to cart_token', () => {
  assertEquals(guardScope({ order_id: '77', cart_token: 'tok' }), { column: 'order_id', value: '77' });
  assertEquals(guardScope({ order_id: null, cart_token: 'tok' }), { column: 'cart_token', value: 'tok' });
  assertEquals(guardScope({ order_id: null, cart_token: null }), null);
});

Deno.test('parseYampiPayload normalizes a cart resource', () => {
  const parsed = parseYampiPayload({
    event: 'cart.reminder',
    time: '2026-08-30 10:40:38',
    resource: {
      id: 111,
      token: 'tok-abc',
      totalizers: { total: 289.81 },
      customer: {
        data: {
          name: 'Gabriella Souza',
          email: 'GABI@example.com',
          phone: { full_number: '16991234567' },
        },
      },
      items: {
        data: [
          { quantity: 1, sku: { data: { id: 9, title: 'Case Couro Porta-Cartões' } } },
        ],
      },
    },
  });
  assertEquals(parsed.cartToken, 'tok-abc');
  assertEquals(parsed.orderId, '111'); // resource.id — usado só quando o evento é de pedido
  assertEquals(parsed.customerEmail, 'gabi@example.com');
  assertEquals(parsed.customerFirstName, 'Gabriella');
  assertEquals(parsed.customerPhone, '16991234567');
  assertEquals(parsed.total, 289.81);
  assertEquals(parsed.itemTitles, ['Case Couro Porta-Cartões']);
  assertEquals(parsed.eventTs !== null, true);
});

Deno.test('parseYampiPayload falls back to tracking_data', () => {
  const parsed = parseYampiPayload({
    event: 'cart.checkout_iniciado',
    resource: { id: 5, token: 't', tracking_data: { name: 'João', email: 'JOAO@x.com' } },
  });
  assertEquals(parsed.customerName, 'João');
  assertEquals(parsed.customerEmail, 'joao@x.com');
  assertEquals(parsed.customerPhone, null);
});
