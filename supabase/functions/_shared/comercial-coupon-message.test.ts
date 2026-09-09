import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildComercialCupomMessage, priceWithCoupon, COMERCIAL_CUPOM_TEMPLATE_NAME } from './comercial-coupon-message.ts';

Deno.test('priceWithCoupon: arredonda em centavos; null sem total', () => {
  assertEquals(priceWithCoupon(159.9, 20), 127.92);
  assertEquals(priceWithCoupon(159.9, 15), 135.92);
  assertEquals(priceWithCoupon(null, 20), null);
});

// Cópia literal do BODY registrado na Meta — yampi-connect/index.ts l.568, template
// `minimal_esteira_comercial_cupom`, com {{1..6}} substituídos pelos `examples` da l.569.
// Se alguém mexer no builder sem mexer no template (ou vice-versa), este assert quebra:
// é a única coisa que impede o preview que o comercial copia de divergir do que a Meta aprovou.
const BODY_META = 'Oi Gabriella, aqui é Hyago da Minimal Cases 👋\n' +
  'Vi que sua Case Minimal Preta ficou separada no carrinho.\n' +
  'Separei um cupom de 20% só pra você: GABRIELLA20 — vale até 12/09.\n' +
  'Quer que eu te ajude a finalizar?';

Deno.test('buildComercialCupomMessage: byte a byte igual ao BODY do template Meta', () => {
  const msg = buildComercialCupomMessage({ nome: 'Gabriella', remetente: 'Hyago', produto: 'Case Minimal Preta', percentual: 20, cupom: 'GABRIELLA20', validade: '12/09' });
  assertEquals(msg, BODY_META);
  assertEquals(COMERCIAL_CUPOM_TEMPLATE_NAME, 'minimal_esteira_comercial_cupom');
});
