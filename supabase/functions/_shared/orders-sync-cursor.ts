// supabase/functions/_shared/orders-sync-cursor.ts
export interface Cursor { page: number; done: boolean; total_pages: number }
/** processed = null → a página falhou: não avança. */
export function nextCursor(c: Cursor, processed: { processedPage: number; totalPages: number } | null): Cursor {
  if (!processed) return c;
  const total = processed.totalPages || c.total_pages;
  if (processed.processedPage >= total) return { page: processed.processedPage, done: true, total_pages: total };
  return { page: processed.processedPage + 1, done: false, total_pages: total };
}
