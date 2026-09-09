import { describe, expect, it } from 'vitest';
import { aggregateComissoes, comissoesToCsv } from './comissoes';
const rows = [
  { recovered_by: 'A', recovery_basis: 'cupom', commission_pct: 3, commission_value: 4.8, order_total: 159.9, paid_at: '2026-09-20T12:00:00Z' },
  { recovered_by: 'A', recovery_basis: 'janela', commission_pct: 3, commission_value: 3, order_total: 100, paid_at: '2026-09-25T12:00:00Z' },
  { recovered_by: 'B', recovery_basis: 'cupom', commission_pct: 5, commission_value: 10, order_total: 200, paid_at: '2026-10-01T12:00:00Z' },
  { recovered_by: null, recovery_basis: null, commission_pct: null, commission_value: null, order_total: 80, paid_at: '2026-09-21T12:00:00Z' },
] as const;
describe('aggregateComissoes', () => {
  it('agrupa mês × comercial; esteira automática separada sem comissão', () => {
    const out = aggregateComissoes([...rows] as never, { A: 'Ana', B: 'Bia' });
    expect(out.map((l) => [l.mes, l.comercial, l.pedidos, l.receita, l.porCupom, l.porJanela, l.comissao])).toEqual([
      ['2026-10', 'Bia', 1, 200, 1, 0, 10],
      ['2026-09', 'Ana', 2, 259.9, 1, 1, 7.8],
      ['2026-09', 'Esteira automática', 1, 80, 0, 0, 0],
    ]);
    expect(out[1].pctMedio).toBe(3);
    expect(out[2].pctMedio).toBeNull();
  });
});
describe('comissoesToCsv', () => {
  it('cabeçalho e ; como separador; neutraliza fórmula', () => {
    const csv = comissoesToCsv([{ mes: '2026-09', comercialId: 'A', comercial: '=HYPERLINK("x")', pedidos: 1, receita: 10, porCupom: 1, porJanela: 0, pctMedio: 3, comissao: 0.3 }]);
    expect(csv.split('\n')[0]).toBe('mes;comercial;pedidos;receita;por_cupom;por_janela;pct_medio;comissao');
    expect(csv.split('\n')[1].startsWith("2026-09;\"'=HYPERLINK")).toBe(true);
  });
});
