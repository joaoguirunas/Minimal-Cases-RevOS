/** CTR por toque: links criados no período agrupados por origem + template. Puro. */
import { describeLinkOrigin, type TrackedLinkRow } from '@/lib/esteira/clicks';

export interface ClickRateRow { key: string; source: string; label: string; enviados: number; clicados: number; cliques: number; ctr: number | null }
type L = Pick<TrackedLinkRow, 'source' | 'label' | 'template_name' | 'channel' | 'clicks'>;

export function aggregateClickRates(links: L[]): ClickRateRow[] {
  const map = new Map<string, ClickRateRow>();
  for (const l of links) {
    const key = `${l.source}|${l.template_name ?? l.label ?? l.channel ?? '-'}`;
    const row = map.get(key) ?? { key, source: l.source, label: describeLinkOrigin(l), enviados: 0, clicados: 0, cliques: 0, ctr: null };
    row.enviados++; row.cliques += l.clicks; if (l.clicks > 0) row.clicados++;
    map.set(key, row);
  }
  return [...map.values()].map((r) => ({ ...r, ctr: r.enviados ? r.clicados / r.enviados : null })).sort((a, b) => b.enviados - a.enviados);
}

export function overallClickRate(links: Array<Pick<TrackedLinkRow, 'clicks'>>): { enviados: number; clicados: number; ctr: number | null } {
  const enviados = links.length;
  const clicados = links.filter((l) => l.clicks > 0).length;
  return { enviados, clicados, ctr: enviados ? clicados / enviados : null };
}
