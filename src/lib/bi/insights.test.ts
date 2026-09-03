import { describe, expect, it } from 'vitest';
import { buildInsights } from './insights';
import type { Agregado } from './reconversao';

const base: Agregado = {
  atual: { reconvertidos: 7, organicos: 3, receita: 1000, ticketMedio: 142.8, leadsTocados: 100, taxa: 0.07, horasMedias: 20, toques: { email: 20, whatsapp: 5, sms: 3, total: 28 } },
  anterior: { reconvertidos: 4, organicos: 2, receita: 600, ticketMedio: 150, leadsTocados: 90, taxa: 0.044, horasMedias: 30, toques: { email: 10, whatsapp: 2, sms: 1, total: 13 } },
  deltas: { receita: 0.66, reconvertidos: 0.75, taxa: 0.59, horas: -0.33 },
  porNivel: { cupom: 4, clique: 2, janela: 1 },
  porNivelReceita: { cupom: 620, clique: 280, janela: 100, organico: 400 },
  funil: { tocados: 100, clicaram: 20, pagaram: 7 },
  porCanalUltimoToque: { email: 5, whatsapp: 2, sms: 0 },
  porDia: [], topCupons: [{ code: 'VOLTA10', pedidos: 4, receita: 620 }],
};

describe('buildInsights', () => {
  it('gera até 3 frases com dados suficientes', () => {
    const s = buildInsights(base);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s.some((x) => x.includes('VOLTA10'))).toBe(true);
    expect(s.some((x) => x.toLowerCase().includes('e-mail'))).toBe(true);
  });
  it('sem base, não inventa', () => {
    expect(buildInsights({ ...base, atual: { ...base.atual, reconvertidos: 1 }, funil: { tocados: 10, clicaram: 1, pagaram: 1 }, porNivel: { cupom: 1, clique: 0, janela: 0 }, porCanalUltimoToque: { email: 1, whatsapp: 0, sms: 0 }, topCupons: [], deltas: { receita: null, reconvertidos: null, taxa: null, horas: null } })).toEqual([]);
  });
  it('emite a frase do funil quando há volume de toques e cliques, mesmo com poucas conversões', () => {
    const s = buildInsights({ ...base, atual: { ...base.atual, reconvertidos: 2 }, funil: { tocados: 200, clicaram: 50, pagaram: 2 }, topCupons: [], porCanalUltimoToque: { email: 0, whatsapp: 0, sms: 0 }, deltas: { receita: null, reconvertidos: null, taxa: null, horas: null } });
    expect(s.some((x) => x.includes('dos tocados clicaram'))).toBe(true);
  });
});
