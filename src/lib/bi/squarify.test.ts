// src/lib/bi/squarify.test.ts
import { describe, it, expect } from 'vitest';
import { squarify } from './squarify';

describe('squarify', () => {
  it('lista vazia → nenhum bloco', () => { expect(squarify([], 400, 200)).toEqual([]); });
  it('ignora valores zero e cobre a área toda sem sair dos limites', () => {
    const tiles = squarify([{ value: 50, data: 'a' }, { value: 30, data: 'b' }, { value: 20, data: 'c' }, { value: 0, data: 'z' }], 400, 200);
    expect(tiles.map((t) => t.data).sort()).toEqual(['a', 'b', 'c']);
    const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
    expect(Math.round(area)).toBe(80000);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(-0.001); expect(t.y).toBeGreaterThanOrEqual(-0.001);
      expect(t.x + t.w).toBeLessThanOrEqual(400.001); expect(t.y + t.h).toBeLessThanOrEqual(200.001);
    }
  });
  it('área proporcional ao valor', () => {
    const tiles = squarify([{ value: 75, data: 'a' }, { value: 25, data: 'b' }], 100, 100);
    const a = tiles.find((t) => t.data === 'a')!;
    expect(Math.round(a.w * a.h)).toBe(7500);
  });
});
