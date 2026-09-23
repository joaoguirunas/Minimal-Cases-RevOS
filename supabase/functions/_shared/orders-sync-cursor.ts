// supabase/functions/_shared/orders-sync-cursor.ts
export interface Cursor { page: number; done: boolean; total_pages: number }
/** processed = null → a página falhou: não avança. */
export function nextCursor(c: Cursor, processed: { processedPage: number; totalPages: number } | null): Cursor {
  if (!processed) return c;
  const total = processed.totalPages || c.total_pages;
  if (processed.processedPage >= total) return { page: processed.processedPage, done: true, total_pages: total };
  return { page: processed.processedPage + 1, done: false, total_pages: total };
}

/**
 * A Yampi não pagina além de 10 mil resultados e aceita no máximo 12 meses por
 * filtro: a carga completa vai mês a mês, paginando dentro de cada mês.
 */
export interface MonthCursor { month: string; page: number; done: boolean }
const addMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
export function monthRange(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return `created_at:${m}-01|${m}-${String(last).padStart(2, '0')}`;
}
export function nextMonthCursor(c: MonthCursor, processed: { processedPage: number; totalPages: number } | null, currentMonth: string): MonthCursor {
  if (!processed) return c;
  if (processed.processedPage < processed.totalPages) return { month: c.month, page: processed.processedPage + 1, done: false };
  if (c.month >= currentMonth) return { month: c.month, page: processed.processedPage, done: true };
  return { month: addMonth(c.month), page: 1, done: false };
}
