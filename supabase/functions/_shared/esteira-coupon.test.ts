import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { judgeExisting, withEsteiraUtm } from './esteira-coupon.ts';

const now = new Date('2026-09-22T12:00:00Z');

Deno.test('cupom válido é reaproveitado com a validade real', () => {
  const r = judgeExisting({ code: 'ANA15', expires_at: '2026-09-27T12:00:00Z' }, now);
  assertEquals(r, { kind: 'ok', code: 'ANA15', expiresAt: '2026-09-27T12:00:00Z', created: false });
});

Deno.test('cupom vencido (ou vencendo em menos de 2h) não é mostrado', () => {
  assertEquals(judgeExisting({ code: 'ANA15', expires_at: '2026-09-22T11:00:00Z' }, now).kind, 'expired');
  assertEquals(judgeExisting({ code: 'ANA15', expires_at: '2026-09-22T13:00:00Z' }, now).kind, 'expired');
});

Deno.test('cupom sem validade conhecida não é mostrado', () => {
  assertEquals(judgeExisting({ code: 'ANA15', expires_at: null }, now).kind, 'expired');
});

Deno.test('UTM entra sem duplicar e sem perder params do carrinho', () => {
  const u = new URL(withEsteiraUtm('https://seguro.minimalcases.com.br/cart?token=abc&utm_source=x', 'whatsapp', 'w1'));
  assertEquals(u.searchParams.get('token'), 'abc');
  assertEquals(u.searchParams.get('utm_source'), 'x');
  assertEquals(u.searchParams.get('utm_medium'), 'whatsapp');
  assertEquals(u.searchParams.get('utm_campaign'), 'carrinho-abandonado');
  assertEquals(u.searchParams.get('utm_content'), 'w1');
});

Deno.test('URL inválida volta intacta', () => {
  assertEquals(withEsteiraUtm('nao-e-url', 'email', 'e4'), 'nao-e-url');
});
