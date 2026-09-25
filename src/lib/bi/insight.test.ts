// src/lib/bi/insight.test.ts
import { describe, it, expect } from 'vitest';
import { driverNote, roiLabel, sparkPercents } from './insight';

describe('driverNote', () => {
  it('aponta a parte que mais explica a alta', () => {
    expect(driverNote([{ label: 'novos', cur: 110, prev: 100 }, { label: 'recorrentes', cur: 40, prev: 20 }]))
      .toBe('▲ 25,0% vs comparação, puxado por recorrentes');
  });
  it('queda aponta a parte que mais caiu', () => {
    expect(driverNote([{ label: 'novos', cur: 50, prev: 100 }, { label: 'recorrentes', cur: 20, prev: 20 }]))
      .toBe('▼ 41,7% vs comparação, puxado por novos');
  });
  it('sem base de comparação → null', () => {
    expect(driverNote([{ label: 'novos', cur: 10, prev: 0 }])).toBeNull();
  });
});

describe('roiLabel', () => {
  it('sem custo pede configuração', () => {
    expect(roiLabel(null, 0)).toEqual({ value: '—', note: 'Configure o custo mensal do CRM para ver o ROI.' });
  });
  it('formata multiplicador', () => {
    expect(roiLabel(12.5, 58.3, true).value).toBe('12,5x');
  });
  it('sem custo fixo configurado avisa que é só o custo das mensagens', () => {
    const r = roiLabel(8.85, 83.03, false);
    expect(r.value).toBe('8,9x');
    expect(r.note).toMatch(/só o custo das mensagens/i);
    expect(r.note).toMatch(/configure o custo mensal/i);
  });
});

describe('sparkPercents', () => {
  it('normaliza pelo máximo', () => { expect(sparkPercents([0, 5, 10])).toEqual([0, 50, 100]); });
  it('tudo zero não divide por zero', () => { expect(sparkPercents([0, 0])).toEqual([0, 0]); });
});
