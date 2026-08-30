/**
 * Centralized date filter utilities for BI PRO hooks.
 * All hooks must import from here — zero local implementations.
 */

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Build a date range filter from period presets or custom dates.
 * Returns null for 'all' (no filter).
 *
 * Supported periods: today, week, last-week, month, 7d, 30d, 90d, 1y, all, personalizado (custom)
 */
export function buildDateFilter(
  period: string,
  dateFrom?: string,
  dateTo?: string
): DateRange | null {
  if (dateFrom && dateTo) return { from: dateFrom, to: dateTo };

  const now = new Date();
  const from = new Date(now);

  switch (period) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = start of week
      from.setDate(now.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'last-week': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from.setDate(now.getDate() - diff - 7);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case 'month':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case '90d':
      from.setDate(now.getDate() - 90);
      break;
    case '7d':
      from.setDate(now.getDate() - 7);
      break;
    case '30d':
      from.setDate(now.getDate() - 30);
      break;
    case '1y':
      from.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return null; // 'all'
  }

  return { from: from.toISOString(), to: now.toISOString() };
}

/**
 * Build a date range for the previous period (for delta comparisons).
 * Returns null if the current period is 'all' or can't be computed.
 */
export function buildPrevDateFilter(
  period: string,
  dateFrom?: string,
  dateTo?: string
): DateRange | null {
  const current = buildDateFilter(period, dateFrom, dateTo);
  if (!current) return null;

  const fromMs = new Date(current.from).getTime();
  const toMs = new Date(current.to).getTime();
  const duration = toMs - fromMs;

  return {
    from: new Date(fromMs - duration).toISOString(),
    to: new Date(toMs - duration).toISOString(),
  };
}
