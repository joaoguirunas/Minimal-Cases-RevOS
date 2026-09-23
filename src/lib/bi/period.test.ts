// src/lib/bi/period.test.ts
import { describe, expect, it } from 'vitest';
import { resolvePeriod, comparePeriod, safeDelta } from './period';
const now = new Date(2026, 8, 23, 15, 0);
describe('período', () => {
  it('30d termina agora e começa à meia-noite de 30 dias atrás', () => {
    const p = resolvePeriod('30d', undefined, now);
    expect(p.to).toEqual(now);
    expect(p.from).toEqual(new Date(2026, 7, 24));
  });
  it('mês passado inteiro', () => {
    const p = resolvePeriod('last-month', undefined, now);
    expect(p.from).toEqual(new Date(2026, 7, 1)); expect(p.to).toEqual(new Date(2026, 8, 1));
  });
  it('comparação com período anterior tem a mesma duração e termina onde o atual começa', () => {
    const p = resolvePeriod('7d', undefined, now); const c = comparePeriod(p, 'previous');
    expect(c.to).toEqual(p.from); expect(c.to.getTime() - c.from.getTime()).toBe(p.to.getTime() - p.from.getTime());
  });
  it('comparação com o ano anterior', () => {
    const p = resolvePeriod('month', undefined, now); const c = comparePeriod(p, 'year');
    expect(c.from).toEqual(new Date(2025, 8, 1));
  });
  it('delta seguro', () => {
    expect(safeDelta(120, 100)).toBeCloseTo(0.2); expect(safeDelta(10, 0)).toBeNull(); expect(safeDelta(null, 5)).toBeNull();
  });
});

describe('estabilidade da chave', () => {
  it('"até agora" é arredondado para o minuto (mesma chave de cache dentro do minuto)', () => {
    const a = resolvePeriod('30d', undefined, new Date(2026, 8, 23, 15, 0, 5, 123));
    const b = resolvePeriod('30d', undefined, new Date(2026, 8, 23, 15, 0, 48, 999));
    expect(a.to.getTime()).toBe(b.to.getTime());
  });
});
