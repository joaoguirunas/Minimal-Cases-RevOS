// src/lib/bi/segments.test.ts
import { describe, it, expect } from 'vitest';
import { SEGMENTS, segmentMeta } from './segments';

describe('segments', () => {
  it('tem os 11 segmentos do banco', () => { expect(SEGMENTS).toHaveLength(11); });
  it('segmento desconhecido tem fallback', () => { expect(segmentMeta('xyz').action).toBe(''); });
  it('Em risco sugere reativação', () => { expect(segmentMeta('Em risco').action).toMatch(/cupom/i); });
});
