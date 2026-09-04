import { describe, expect, it } from 'vitest';
import { aggregateAbTest, normalCdf, twoProportionZ, type AbInput, type AbVariantRow } from './abTest';

describe('twoProportionZ', () => {
  it('calcula z e p para duas proporções', () => {
    const r = twoProportionZ(50, 1000, 70, 1000);
    expect(r).not.toBeNull();
    expect(r!.z).toBeCloseTo(-1.88, 1);
    expect(r!.p).toBeGreaterThan(0.055);
    expect(r!.p).toBeLessThan(0.065);
  });

  it('retorna null quando amostra vazia', () => {
    expect(twoProportionZ(1, 0, 1, 10)).toBeNull();
    expect(twoProportionZ(1, 10, 1, 0)).toBeNull();
  });

  it('retorna null quando proporção pooled é 0 ou 1', () => {
    expect(twoProportionZ(0, 10, 0, 10)).toBeNull();
    expect(twoProportionZ(10, 10, 10, 10)).toBeNull();
  });
});

describe('normalCdf', () => {
  it('normalCdf(0) = 0.5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
  });
  it('normalCdf(1.96) ≈ 0.975', () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
  });
});

describe('aggregateAbTest', () => {
  const variants: AbVariantRow[] = [
    { id: 'a', key: 'A', name: 'Variante A', is_control: true, weight: 50 },
    { id: 'b', key: 'B', name: 'Variante B', is_control: false, weight: 50 },
  ];

  const buildInput = (leadsPerVariant: number, reconvA: number, reconvB: number): AbInput => {
    const assignments: AbInput['assignments'] = [];
    const reconversions: AbInput['reconversions'] = [];
    for (const [variantId, reconvCount] of [['a', reconvA], ['b', reconvB]] as const) {
      for (let n = 0; n < leadsPerVariant; n++) {
        const leadId = `${variantId}-${n}`;
        assignments.push({ variant_id: variantId, lead_id: leadId });
        reconversions.push({ ab_variant_id: variantId, order_total: n < reconvCount ? 100 : null, attributed: n < reconvCount });
      }
    }
    return { variants, assignments, touches: [], links: [], reconversions };
  };

  it('agrega leads, taxa, lift e nível de confiança com amostra suficiente', () => {
    const input = buildInput(40, 10, 16);
    const { variants: stats, confidence } = aggregateAbTest(input);

    const a = stats.find((v) => v.key === 'A')!;
    const b = stats.find((v) => v.key === 'B')!;
    expect(a.leads).toBe(40);
    expect(b.leads).toBe(40);
    expect(a.taxa).toBeCloseTo(0.25);
    expect(b.taxa).toBeCloseTo(0.4);
    expect(confidence.lift).toBeCloseTo(0.6);
    expect(['baixa', 'media']).toContain(confidence.nivel);
    expect(confidence.melhor).toBe('B');
    expect(confidence.z).not.toBeNull();
  });

  it('marca insuficiente e z null quando alguma variante tem poucos leads', () => {
    const input = buildInput(10, 3, 4);
    const { confidence } = aggregateAbTest(input);
    expect(confidence.nivel).toBe('insuficiente');
    expect(confidence.z).toBeNull();
  });

  it('conta tocados como pessoas distintas e enviados/clicados a partir de links', () => {
    const input: AbInput = {
      variants,
      assignments: [
        { variant_id: 'a', lead_id: 'l1' },
        { variant_id: 'a', lead_id: 'l2' },
        { variant_id: 'b', lead_id: 'l3' },
      ],
      touches: [
        { ab_variant_id: 'a', person_id: 'p1' },
        { ab_variant_id: 'a', person_id: 'p1' },
        { ab_variant_id: 'a', person_id: 'p2' },
        { ab_variant_id: 'b', person_id: 'p3' },
      ],
      links: [
        { ab_variant_id: 'a', clicks: 0 },
        { ab_variant_id: 'a', clicks: 2 },
        { ab_variant_id: 'b', clicks: 0 },
      ],
      reconversions: [],
    };
    const { variants: stats } = aggregateAbTest(input);
    const a = stats.find((v) => v.key === 'A')!;
    const b = stats.find((v) => v.key === 'B')!;
    expect(a.tocados).toBe(2);
    expect(a.enviados).toBe(2);
    expect(a.clicados).toBe(1);
    expect(a.ctr).toBeCloseTo(0.5);
    expect(b.enviados).toBe(1);
    expect(b.clicados).toBe(0);
    expect(b.ctr).toBe(0);
  });
});
