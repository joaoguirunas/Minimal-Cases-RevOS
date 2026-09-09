/**
 * comissoes — comissões por comercial (mês × pessoa) da esteira de recuperação.
 *
 * Agrega `esteira_reconversions` por mês de pagamento × comercial que
 * recuperou o pedido (`recovered_by`). Pedidos sem `recovered_by` (esteira
 * automática, sem intervenção humana) entram numa linha separada, sem
 * comissão.
 */

export interface ComissaoRow {
  recovered_by: string | null;
  recovery_basis: 'cupom' | 'janela' | null;
  commission_pct: number | null;
  commission_value: number | null;
  order_total: number | null;
  paid_at: string;
}

export interface ComissaoLinha {
  mes: string; // YYYY-MM
  comercialId: string | null;
  comercial: string;
  pedidos: number;
  receita: number;
  porCupom: number;
  porJanela: number;
  pctMedio: number | null;
  comissao: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function aggregateComissoes(rows: ComissaoRow[], names: Record<string, string>): ComissaoLinha[] {
  const map = new Map<string, ComissaoLinha & { pctSum: number; pctN: number }>();
  for (const r of rows) {
    const mes = r.paid_at.slice(0, 7);
    const key = `${mes}|${r.recovered_by ?? ''}`;
    const cur = map.get(key) ?? {
      mes,
      comercialId: r.recovered_by,
      comercial: r.recovered_by ? (names[r.recovered_by] ?? 'Comercial') : 'Esteira automática',
      pedidos: 0,
      receita: 0,
      porCupom: 0,
      porJanela: 0,
      pctMedio: null,
      comissao: 0,
      pctSum: 0,
      pctN: 0,
    };
    cur.pedidos++;
    cur.receita = round2(cur.receita + (r.order_total ?? 0));
    if (r.recovery_basis === 'cupom') cur.porCupom++;
    if (r.recovery_basis === 'janela') cur.porJanela++;
    if (r.recovered_by) {
      cur.comissao = round2(cur.comissao + (r.commission_value ?? 0));
      if (r.commission_pct !== null) {
        cur.pctSum += r.commission_pct;
        cur.pctN++;
      }
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ pctSum, pctN, ...l }) => ({ ...l, pctMedio: pctN > 0 ? round2(pctSum / pctN) : null }))
    .sort((a, b) => (a.mes !== b.mes
      ? (a.mes < b.mes ? 1 : -1)
      : (a.comercialId === null ? 1 : b.comercialId === null ? -1 : a.comercial.localeCompare(b.comercial))));
}

const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function comissoesToCsv(linhas: ComissaoLinha[]): string {
  const head = 'mes;comercial;pedidos;receita;por_cupom;por_janela;pct_medio;comissao';
  return [
    head,
    ...linhas.map((l) => [l.mes, l.comercial, l.pedidos, l.receita, l.porCupom, l.porJanela, l.pctMedio ?? '', l.comissao].map(csvCell).join(';')),
  ].join('\n');
}
