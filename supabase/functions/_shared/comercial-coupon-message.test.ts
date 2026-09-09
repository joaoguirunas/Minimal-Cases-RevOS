import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildComercialCupomMessage, priceWithCoupon, COMERCIAL_CUPOM_TEMPLATE_NAME } from './comercial-coupon-message.ts';

Deno.test('priceWithCoupon: arredonda em centavos; null sem total', () => {
  assertEquals(priceWithCoupon(159.9, 20), 127.92);
  assertEquals(priceWithCoupon(159.9, 15), 135.92);
  assertEquals(priceWithCoupon(null, 20), null);
});

Deno.test('buildComercialCupomMessage: mesmo texto do template Meta, com os 6 parâmetros', () => {
  const msg = buildComercialCupomMessage({ nome: 'Gabriella', remetente: 'Hyago', produto: 'Case Minimal Preta', percentual: 20, cupom: 'GABRIELLA20', validade: '12/09' });
  assertEquals(msg.includes('Oi Gabriella, aqui é Hyago da Minimal Cases'), true);
  assertEquals(msg.includes('cupom de 20% só pra você: GABRIELLA20'), true);
  assertEquals(msg.includes('vale até 12/09'), true);
  assertEquals(COMERCIAL_CUPOM_TEMPLATE_NAME, 'minimal_esteira_comercial_cupom');
});
