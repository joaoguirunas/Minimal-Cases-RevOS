// src/lib/bi/fetchAllPages.ts
/** Busca página a página até acabar (ou até `max`). Página vazia/incompleta encerra. */
export async function fetchAllPages<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>,
  { pageSize = 1000, max = 50_000 }: { pageSize?: number; max?: number } = {}): Promise<T[]> {
  const out: T[] = [];
  while (out.length < max) {
    const limit = Math.min(pageSize, max - out.length);
    const page = await fetchPage(out.length, limit);
    out.push(...page.slice(0, limit));
    if (page.length < limit) break;
  }
  return out;
}
