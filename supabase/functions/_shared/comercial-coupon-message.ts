/**
 * _shared/comercial-coupon-message.ts — texto do cupom do comercial (puro, testável).
 *
 * O texto é idêntico ao BODY do template Meta `minimal_esteira_comercial_cupom`
 * (spec §5.1): os 6 parâmetros entram na ordem {{1..6}}. Manter os dois em sincronia —
 * o preview que o comercial copia tem que ser o mesmo texto que a Meta aprovou.
 */

export const COMERCIAL_CUPOM_TEMPLATE_NAME = 'minimal_esteira_comercial_cupom';

/** Total do carrinho com o desconto aplicado, arredondado em centavos. `null` sem total. */
export function priceWithCoupon(total: number | null, percent: number): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.round(total * (1 - percent / 100) * 100) / 100;
}

export interface CupomMessageVars {
  nome: string;
  remetente: string;
  produto: string;
  percentual: number;
  cupom: string;
  validade: string;
}

/** Texto idêntico ao BODY do template Meta (yampi-connect, spec §5.1) — {{1..6}} nesta ordem. */
export function buildComercialCupomMessage(v: CupomMessageVars): string {
  return `Oi ${v.nome}, aqui é ${v.remetente} da Minimal Cases 👋\n` +
    `Vi que sua ${v.produto} ficou separada no carrinho.\n` +
    `Separei um cupom de ${v.percentual}% só pra você: ${v.cupom} — vale até ${v.validade}.\n` +
    `Quer que eu te ajude a finalizar?`;
}
