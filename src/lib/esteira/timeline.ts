/**
 * groupByDay — agrupa a timeline unificada da esteira por dia, com rótulos
 * relativos ("Hoje"/"Ontem") ou dd/MM para os demais dias.
 *
 * Entradas com data inválida (`e.at` não parseável) são descartadas em vez
 * de propagar `Invalid Date` pro grupo/rótulo.
 */

import { format, isSameDay, subDays } from 'date-fns';
import type { TimelineEntry } from '@/hooks/useEsteiraLead';

export function groupByDay(entries: TimelineEntry[], now = new Date()): Array<{ label: string; items: TimelineEntry[] }> {
  const groups = new Map<string, { label: string; items: TimelineEntry[] }>();
  for (const e of entries) {
    const d = new Date(e.at);
    if (!Number.isFinite(d.getTime())) continue;
    const key = format(d, 'yyyy-MM-dd');
    const label = isSameDay(d, now) ? 'Hoje' : isSameDay(d, subDays(now, 1)) ? 'Ontem' : format(d, 'dd/MM');
    (groups.get(key) ?? groups.set(key, { label, items: [] }).get(key)!).items.push(e);
  }
  return [...groups.entries()].sort(([a], [b]) => (a > b ? -1 : 1)).map(([, v]) => v);
}
