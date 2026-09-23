// supabase/functions/_shared/orders-sync-cursor.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { nextCursor } from './orders-sync-cursor.ts';

Deno.test('avança uma página por lote processado e marca done na última', () => {
  assertEquals(nextCursor({ page: 1, done: false, total_pages: 3 }, { processedPage: 1, totalPages: 3 }), { page: 2, done: false, total_pages: 3 });
  assertEquals(nextCursor({ page: 3, done: false, total_pages: 3 }, { processedPage: 3, totalPages: 3 }), { page: 3, done: true, total_pages: 3 });
});
Deno.test('falha no meio não avança (retoma da mesma página)', () => {
  assertEquals(nextCursor({ page: 7, done: false, total_pages: 350 }, null), { page: 7, done: false, total_pages: 350 });
});
