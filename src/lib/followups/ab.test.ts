import { describe, expect, it } from 'vitest';
import { abStatusLabel, bucketFromMd5Hex, expectedSplit, pickVariant, variantTone } from './ab';

describe('bucketFromMd5Hex', () => {
  it('espelha parseInt(hex.slice(0,6),16) % 10000', () => {
    expect(bucketFromMd5Hex('ffffff00')).toBe(7215);
  });
});

describe('pickVariant', () => {
  const fiftyFifty = [
    { key: 'A', weight: 50 },
    { key: 'B', weight: 50 },
  ];

  it('bucket 4999 cai na primeira variante (A 50%)', () => {
    expect(pickVariant(4999, fiftyFifty)?.key).toBe('A');
  });

  it('bucket 5000 cai na segunda variante (B 50%)', () => {
    expect(pickVariant(5000, fiftyFifty)?.key).toBe('B');
  });

  it('pesos 0/100 → sempre a segunda variante', () => {
    const zeroHundred = [
      { key: 'A', weight: 0 },
      { key: 'B', weight: 100 },
    ];
    expect(pickVariant(0, zeroHundred)?.key).toBe('B');
    expect(pickVariant(9999, zeroHundred)?.key).toBe('B');
  });

  it('lista vazia → null', () => {
    expect(pickVariant(1234, [])).toBeNull();
  });
});

describe('expectedSplit', () => {
  it('formata "key weight%" separados por ·', () => {
    expect(
      expectedSplit([
        { key: 'A', weight: 50 },
        { key: 'B', weight: 50 },
      ]),
    ).toBe('A 50% · B 50%');
  });
});

describe('variantTone', () => {
  it('mapeia comum·A·B·C para os tons do design system', () => {
    expect(variantTone('A')).toBe('info');
    expect(variantTone('B')).toBe('violet');
    expect(variantTone('C')).toBe('warning');
    expect(variantTone(null)).toBe('neutral');
    expect(variantTone('comum')).toBe('neutral');
  });
});

describe('abStatusLabel', () => {
  it('traduz o status do experimento', () => {
    expect(abStatusLabel('draft')).toBe('Rascunho');
    expect(abStatusLabel('running')).toBe('Em andamento');
    expect(abStatusLabel('paused')).toBe('Pausado');
    expect(abStatusLabel('finished')).toBe('Encerrado');
  });
});
