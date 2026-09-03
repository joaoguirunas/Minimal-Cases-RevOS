import type { Agregado } from './reconversao';

const pct = (n: number, d: number) => Math.round((n / d) * 100);
const CANAL = { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' } as const;

/** Frases curtas e verificáveis a partir dos agregados. Nunca especula: só com n ≥ 3. */
export function buildInsights(a: Agregado): string[] {
  const out: string[] = [];
  const total = a.atual.reconvertidos;
  if (total >= 3 && a.topCupons[0]) {
    const c = a.topCupons[0];
    const receitaAtrib = a.porNivelReceita.cupom + a.porNivelReceita.clique + a.porNivelReceita.janela;
    if (receitaAtrib > 0) out.push(`${c.code} respondeu por ${pct(c.receita, receitaAtrib)}% da receita recuperada (${c.pedidos} pedidos).`);
  }
  if (total >= 3) {
    const [canal, n] = (Object.entries(a.porCanalUltimoToque) as Array<[keyof typeof CANAL, number]>).sort((x, y) => y[1] - x[1])[0];
    if (n >= 2) out.push(`${CANAL[canal]} foi o canal decisivo em ${n} de ${total} recuperações.`);
  }
  if (a.deltas.horas !== null && a.anterior.reconvertidos >= 3 && total >= 3) {
    const v = Math.round(Math.abs(a.deltas.horas) * 100);
    if (v >= 10) out.push(`Tempo médio até pagar ${a.deltas.horas < 0 ? 'caiu' : 'subiu'} ${v}% vs. período anterior.`);
  }
  if (out.length < 3 && total >= 3 && a.funil.tocados >= 20 && a.funil.clicaram >= 3) {
    out.push(`${pct(a.funil.clicaram, a.funil.tocados)}% dos tocados clicaram no link; ${pct(a.funil.pagaram, a.funil.clicaram)}% dos que clicaram pagaram.`);
  }
  return out.slice(0, 3);
}
