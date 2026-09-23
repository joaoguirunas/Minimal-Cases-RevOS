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

import { nextMonthCursor, monthRange } from './orders-sync-cursor.ts';
Deno.test('mês a mês: avança página, depois o mês, e termina no mês atual', () => {
  assertEquals(nextMonthCursor({ month: '2025-01', page: 1, done: false }, { processedPage: 1, totalPages: 3 }, '2026-09'), { month: '2025-01', page: 2, done: false });
  assertEquals(nextMonthCursor({ month: '2025-01', page: 3, done: false }, { processedPage: 3, totalPages: 3 }, '2026-09'), { month: '2025-02', page: 1, done: false });
  assertEquals(nextMonthCursor({ month: '2025-12', page: 1, done: false }, { processedPage: 1, totalPages: 0 }, '2026-09'), { month: '2026-01', page: 1, done: false });
  assertEquals(nextMonthCursor({ month: '2026-09', page: 2, done: false }, { processedPage: 2, totalPages: 2 }, '2026-09'), { month: '2026-09', page: 2, done: true });
  assertEquals(nextMonthCursor({ month: '2025-05', page: 4, done: false }, null, '2026-09'), { month: '2025-05', page: 4, done: false });
});
Deno.test('intervalo do mês no formato da Yampi', () => {
  assertEquals(monthRange('2026-02'), 'created_at:2026-02-01|2026-02-28');
  assertEquals(monthRange('2024-02'), 'created_at:2024-02-01|2024-02-29');
});
