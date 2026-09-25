// src/lib/bi/fetchAllPages.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages } from './fetchAllPages';

describe('fetchAllPages', () => {
  it('junta páginas até a última incompleta', async () => {
    const data = Array.from({ length: 25 }, (_, i) => i);
    const fn = vi.fn(async (off: number, lim: number) => data.slice(off, off + lim));
    expect(await fetchAllPages(fn, { pageSize: 10 })).toEqual(data);
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('para no máximo', async () => {
    const fn = vi.fn(async (_o: number, lim: number) => Array(lim).fill(1));
    expect(await fetchAllPages(fn, { pageSize: 10, max: 25 })).toHaveLength(25);
  });
  it('página vazia encerra sem loop', async () => {
    const fn = vi.fn(async () => [] as number[]);
    expect(await fetchAllPages(fn, { pageSize: 10 })).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
