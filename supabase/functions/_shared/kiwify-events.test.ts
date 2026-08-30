/**
 * Tests for kiwify-events (KFY-1.5) — precedence, capitalization-resilient parsing,
 * monetary/variable rendering, opt-in gating.
 *
 * Run: deno test supabase/functions/_shared/kiwify-events.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildVariableMap,
  canSend,
  categoryFromJsonData,
  centavosToBRL,
  EVENT_TYPE_TO_TRIGGER,
  isPossessionTrigger,
  parseKiwifyPayload,
  PRECEDENCE_RANK,
  rankOf,
  renderTemplate,
  resolveStepVariables,
  resolveTrigger,
  shouldProceed,
} from './kiwify-events.ts';

// ── Possession gate (KFY-2.2 course badge) ─────────────────────────────────────

Deno.test('isPossessionTrigger: only compra_aprovada and subscription_renewed own a product', () => {
  assertEquals(isPossessionTrigger('compra_aprovada'), true);
  assertEquals(isPossessionTrigger('subscription_renewed'), true);
  // Payment-intent, failures and reversals are NOT ownership → no course badge row.
  for (
    const t of [
      'pix_gerado', 'boleto_gerado', 'carrinho_abandonado', 'compra_recusada',
      'subscription_late', 'compra_reembolsada', 'chargeback', 'subscription_canceled',
    ] as const
  ) {
    assertEquals(isPossessionTrigger(t), false);
  }
  assertEquals(isPossessionTrigger(null), false);
});

// ── Precedence ────────────────────────────────────────────────────────────────

Deno.test('PRECEDENCE_RANK: refund/chargeback outrank paid; cart is lowest', () => {
  assertEquals(PRECEDENCE_RANK.carrinho_abandonado < PRECEDENCE_RANK.pix_gerado, true);
  assertEquals(PRECEDENCE_RANK.pix_gerado < PRECEDENCE_RANK.compra_aprovada, true);
  assertEquals(PRECEDENCE_RANK.compra_aprovada < PRECEDENCE_RANK.compra_reembolsada, true);
  assertEquals(PRECEDENCE_RANK.compra_aprovada < PRECEDENCE_RANK.chargeback, true);
});

Deno.test('shouldProceed: no prior event always proceeds', () => {
  assertEquals(shouldProceed(rankOf('pix_gerado'), 1000, null, null), true);
});

Deno.test('shouldProceed: late lower-rank event does not regress (pix after paid)', () => {
  const paid = rankOf('compra_aprovada');
  const pix = rankOf('pix_gerado');
  assertEquals(shouldProceed(pix, 2000, paid, 1000), false);
});

Deno.test('shouldProceed: more-advanced event proceeds (refund after paid)', () => {
  const paid = rankOf('compra_aprovada');
  const refund = rankOf('compra_reembolsada');
  assertEquals(shouldProceed(refund, 3000, paid, 1000), true);
});

Deno.test('shouldProceed: same rank proceeds only if strictly newer', () => {
  const paid = rankOf('compra_aprovada');
  assertEquals(shouldProceed(paid, 2000, paid, 1000), true);
  assertEquals(shouldProceed(paid, 1000, paid, 1000), false);
  assertEquals(shouldProceed(paid, 500, paid, 1000), false);
});

Deno.test('resolveTrigger: prefers stored trigger, falls back via event_type', () => {
  assertEquals(resolveTrigger('compra_aprovada', 'anything'), 'compra_aprovada');
  assertEquals(resolveTrigger(null, 'order_approved'), 'compra_aprovada');
  assertEquals(resolveTrigger(null, 'unknown_event'), null);
  assertEquals(resolveTrigger('not_a_trigger', null), null);
});

Deno.test('EVENT_TYPE_TO_TRIGGER covers the paid/refund/chargeback aliases', () => {
  assertEquals(EVENT_TYPE_TO_TRIGGER['paid'], 'compra_aprovada');
  assertEquals(EVENT_TYPE_TO_TRIGGER['chargedback'], 'chargeback');
  assertEquals(EVENT_TYPE_TO_TRIGGER['refunded'], 'compra_reembolsada');
});

// ── Parsing (capitalization) ──────────────────────────────────────────────────

Deno.test('parseKiwifyPayload: reads capitalized classic shape (Customer/Product/Commissions)', () => {
  const raw = {
    order_id: 'ord_123',
    webhook_event_type: 'order_approved',
    created_at: '2026-07-02T10:00:00.000Z',
    Customer: { full_name: 'João Silva', email: 'JOAO@EXAMPLE.COM', mobile: '+5511999999999' },
    Product: { product_id: 'prod_9', product_name: 'Curso X' },
    Commissions: { charge_amount: 12048 },
    pix_code: '00020126...',
  };
  const ev = parseKiwifyPayload(raw);
  assertEquals(ev.orderId, 'ord_123');
  assertEquals(ev.customerName, 'João Silva');
  assertEquals(ev.customerFirstName, 'João');
  assertEquals(ev.customerEmail, 'joao@example.com'); // lowercased
  assertEquals(ev.customerPhone, '+5511999999999');
  assertEquals(ev.productId, 'prod_9');
  assertEquals(ev.productName, 'Curso X');
  assertEquals(ev.amountCentavos, 12048);
  assertEquals(ev.pixCode, '00020126...');
  assertEquals(ev.eventTs, Date.parse('2026-07-02T10:00:00.000Z'));
});

Deno.test('parseKiwifyPayload: reads snake_case REST-like shape', () => {
  const raw = {
    order_id: 'ord_777',
    customer: { name: 'Maria', email: 'maria@x.com', mobile: '5511888888888' },
    product: { id: 'p1', name: 'Prod' },
    net_amount: 5000,
  };
  const ev = parseKiwifyPayload(raw);
  assertEquals(ev.customerName, 'Maria');
  assertEquals(ev.customerFirstName, 'Maria');
  assertEquals(ev.productId, 'p1');
  assertEquals(ev.amountCentavos, 5000);
});

Deno.test('parseKiwifyPayload: subscription id + missing fields tolerated', () => {
  const ev = parseKiwifyPayload({ subscription: { id: 'sub_1' } });
  assertEquals(ev.subscriptionId, 'sub_1');
  assertEquals(ev.orderId, null);
  assertEquals(ev.amountCentavos, null);
  assertEquals(ev.customerName, null);
});

Deno.test('parseKiwifyPayload: numeric-string amount parsed to centavos', () => {
  const ev = parseKiwifyPayload({ Commissions: { charge_amount: '12048' } });
  assertEquals(ev.amountCentavos, 12048);
});

// Real sandbox payload captured 2026-07-02 (architecture §8.7) — boleto/billet_created.
Deno.test('real payload (billet_created): trigger, product, boleto fields, valor', () => {
  const raw = {
    webhook_event_type: 'billet_created',
    order_id: 'ord_real_1',
    boleto_URL: 'https://kiwify.com.br/boleto/abc',
    boleto_barcode: '34191.79001 01043.510047 91020.150008 5 96610000012048',
    boleto_expiry_date: '06/07/2026',
    Customer: { full_name: 'Cliente Real', email: 'Cliente@Real.com', mobile: '5511987654321' },
    Product: { product_id: 'prod_real', product_name: 'Curso Real' },
    Commissions: { charge_amount: 12048 },
  };
  assertEquals(resolveTrigger(null, 'billet_created'), 'boleto_gerado');

  const ev = parseKiwifyPayload(raw);
  assertEquals(ev.productId, 'prod_real');
  assertEquals(ev.productName, 'Curso Real');
  assertEquals(ev.customerPhone, '5511987654321');
  assertEquals(ev.customerEmail, 'cliente@real.com');
  assertEquals(ev.boletoUrl, 'https://kiwify.com.br/boleto/abc');
  assertEquals(ev.boletoExpiry, '06/07/2026'); // raw DD/MM/YYYY, not reformatted

  const vars = buildVariableMap(ev);
  assertEquals(vars.produto, 'Curso Real');
  assertEquals(vars.valor, 'R$ 120,48');
  assertEquals(vars.link_boleto, 'https://kiwify.com.br/boleto/abc');
  assertEquals(vars.vencimento_boleto, '06/07/2026');
});

// ── Money + variables ─────────────────────────────────────────────────────────

Deno.test('centavosToBRL: integer centavos to BRL string', () => {
  assertEquals(centavosToBRL(12048), 'R$ 120,48');
  assertEquals(centavosToBRL(5000), 'R$ 50,00');
  assertEquals(centavosToBRL(99), 'R$ 0,99');
  assertEquals(centavosToBRL(null), '');
});

Deno.test('buildVariableMap: maps all supported vars, valor from centavos', () => {
  const ev = parseKiwifyPayload({
    Customer: { full_name: 'Ana Paula', email: 'a@b.com' },
    Product: { product_name: 'Mentoria' },
    Commissions: { charge_amount: 29900 },
    boleto_URL: 'https://bol/x',
    pix_code: 'PIXCODE',
  });
  const vars = buildVariableMap(ev);
  assertEquals(vars.nome, 'Ana Paula');
  assertEquals(vars.primeiro_nome, 'Ana');
  assertEquals(vars.produto, 'Mentoria');
  assertEquals(vars.valor, 'R$ 299,00');
  assertEquals(vars.link_boleto, 'https://bol/x');
  assertEquals(vars.pix_copia_cola, 'PIXCODE');
  assertEquals(vars.link_checkout, '');
});

Deno.test('renderTemplate: substitutes known tokens, blanks unknown', () => {
  const vars = { nome: 'Ana', valor: 'R$ 10,00' };
  assertEquals(renderTemplate('Oi {{nome}}, total {{valor}}', vars), 'Oi Ana, total R$ 10,00');
  assertEquals(renderTemplate('{{ nome }} e {{desconhecido}}', vars), 'Ana e ');
});

Deno.test('resolveStepVariables: step statics override and are themselves rendered', () => {
  const eventVars = { nome: 'Ana', produto: 'Curso' };
  const out = resolveStepVariables({ saudacao: 'Olá {{nome}}', extra: 'x' }, eventVars);
  assertEquals(out.nome, 'Ana');
  assertEquals(out.saudacao, 'Olá Ana');
  assertEquals(out.extra, 'x');
});

// ── Opt-in gating ─────────────────────────────────────────────────────────────

Deno.test('categoryFromJsonData: normalizes case; unknown → null (fail-safe)', () => {
  assertEquals(categoryFromJsonData({ category: 'utility' }), 'UTILITY');
  assertEquals(categoryFromJsonData({ category: 'MARKETING' }), 'MARKETING');
  assertEquals(categoryFromJsonData({ category: 'AUTHENTICATION' }), null);
  assertEquals(categoryFromJsonData({}), null);
  assertEquals(categoryFromJsonData(null), null);
});

Deno.test('canSend: UTILITY always; MARKETING/unknown only with opt-in', () => {
  assertEquals(canSend('UTILITY', false), true);
  assertEquals(canSend('UTILITY', true), true);
  assertEquals(canSend('MARKETING', false), false);
  assertEquals(canSend('MARKETING', true), true);
  assertEquals(canSend(null, false), false); // fail-safe
  assertEquals(canSend(null, true), true);
});
