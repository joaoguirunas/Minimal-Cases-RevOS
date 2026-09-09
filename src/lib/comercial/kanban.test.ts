import { describe, expect, it } from 'vitest';
import { buildCommercialColumns, stageColumns, groupByColumn, ageDays, COMMERCIAL_POOL_STAGES } from './kanban';

const st = (id: string, name: string, order_index: number) => ({ id, name, nome: name, order_index, ordem: order_index, leads_pipelines_id: 'P', pipeline_id: 'P', active: true, ativo: true });
const stages = [st('ca', 'Carrinho abandonado', 0), st('er', 'Em recuperação', 1), st('en', 'Engajou', 2), st('neg', 'Em negociação', 3), st('pp', 'Pagamento pendente', 4), st('pr', 'Pagamento recusado', 5), st('rec', 'Recuperado', 6), st('per', 'Perdido', 7)];

describe('buildCommercialColumns', () => {
  it('3 colunas: disponíveis (3 stages), em negociação, recuperado', () => {
    const cols = buildCommercialColumns(stages as never);
    expect(cols.map((c) => c.nome)).toEqual(['Carrinhos disponíveis', 'Em negociação', 'Recuperado']);
    expect(cols[0].stageIds).toEqual(['ca', 'er', 'en']);
    expect(cols[1].stageIds).toEqual(['neg']);
    expect(cols[2].stageIds).toEqual(['rec']);
    expect(COMMERCIAL_POOL_STAGES).toEqual(['Carrinho abandonado', 'Em recuperação', 'Engajou']);
  });
  it('omite coluna cujo stage não existe no pipeline', () => {
    const cols = buildCommercialColumns(stages.filter((s) => s.id !== 'neg') as never);
    expect(cols.map((c) => c.nome)).toEqual(['Carrinhos disponíveis', 'Recuperado']);
  });
});

describe('stageColumns + groupByColumn', () => {
  it('1 stage = 1 coluna; agrupa por stageIds; sem stage válido cai na primeira', () => {
    const cols = stageColumns(stages.slice(0, 2) as never);
    expect(cols.map((c) => c.id)).toEqual(['ca', 'er']);
    const g = groupByColumn([{ id: 'a', leads_stages_id: 'er' }, { id: 'b', leads_stages_id: 'zzz' }] as never, cols);
    expect(g['er'].map((n) => n.id)).toEqual(['a']);
    expect(g['ca'].map((n) => n.id)).toEqual(['b']);
  });
  it('colunas compostas somam os stages', () => {
    const cols = buildCommercialColumns(stages as never);
    const g = groupByColumn([{ id: 'a', leads_stages_id: 'ca' }, { id: 'b', leads_stages_id: 'en' }, { id: 'c', leads_stages_id: 'neg' }] as never, cols);
    expect(g[cols[0].id].map((n) => n.id)).toEqual(['a', 'b']);
    expect(g['neg'].map((n) => n.id)).toEqual(['c']);
  });
  it('fallbackToFirst: false descarta quem não casa com nenhuma coluna', () => {
    // Pagamento pendente/recusado/Perdido ficam fora da visão do comercial: um lead
    // dele nesses stages não pode aparecer como "carrinho disponível".
    const cols = buildCommercialColumns(stages as never);
    const negocios = [
      { id: 'a', leads_stages_id: 'ca' },
      { id: 'x', leads_stages_id: 'pp' },
      { id: 'y', leads_stages_id: 'per' },
      { id: 'c', leads_stages_id: 'neg' },
    ] as never;
    const g = groupByColumn(negocios, cols, { fallbackToFirst: false });
    expect(g[cols[0].id].map((n) => n.id)).toEqual(['a']);
    expect(g['neg'].map((n) => n.id)).toEqual(['c']);
    expect(Object.values(g).flat()).toHaveLength(2);
    // padrão continua sendo o de hoje
    expect(groupByColumn(negocios, cols)[cols[0].id].map((n) => n.id)).toEqual(['a', 'x', 'y']);
  });
});

describe('ageDays', () => {
  it('dias inteiros desde created_at', () => {
    expect(ageDays('2026-09-01T12:00:00Z', new Date('2026-09-20T11:00:00Z'))).toBe(18);
    expect(ageDays('2026-09-20T10:00:00Z', new Date('2026-09-20T11:00:00Z'))).toBe(0);
  });
});
