import { aggregateClickRates, overallClickRate, type ClickRateRow } from './clicks';

export type Nivel = 'cupom' | 'clique' | 'janela';
export interface RecRow { order_total: number | null; paid_at: string; attributed: boolean; attribution_level: Nivel | null; people_id: string | null; hours_since_last_touch: number | null; touches_email: number; touches_whatsapp: number; touches_sms: number; coupon_code: string | null }
export interface TouchRow { channel: string; person_id: string | null; fired_at: string | null }
export interface ClickRow { people_id: string | null; first_clicked_at: string | null }
export interface Kpis { reconvertidos: number; organicos: number; receita: number; ticketMedio: number | null; leadsTocados: number; taxa: number | null; horasMedias: number | null; toques: { email: number; whatsapp: number; sms: number; total: number } }
export interface Agregado {
  atual: Kpis; anterior: Kpis;
  deltas: { receita: number | null; reconvertidos: number | null; taxa: number | null; horas: number | null };
  porNivel: Record<Nivel, number>;
  porNivelReceita: Record<Nivel | 'organico', number>;
  funil: { tocados: number; clicaram: number; pagaram: number };
  porCanalUltimoToque: Record<'email' | 'whatsapp' | 'sms', number>;
  porDia: Array<{ dia: string; reconversoes: number; receita: number }>;
  topCupons: Array<{ code: string; pedidos: number; receita: number }>;
  cliquesPorToque: ClickRateRow[];
  ctrGeral: { enviados: number; clicados: number; ctr: number | null };
}

const canal = (c: string) => (c === 'email' ? 'email' : c === 'sms' ? 'sms' : 'whatsapp') as 'email' | 'whatsapp' | 'sms';

export function kpis(rows: RecRow[], touches: TouchRow[]): Kpis {
  const attributed = rows.filter((r) => r.attributed);
  const receita = attributed.reduce((a, r) => a + (r.order_total ?? 0), 0);
  const tocados = new Set(touches.map((t) => t.person_id).filter(Boolean)).size;
  const toques = { email: 0, whatsapp: 0, sms: 0, total: 0 };
  for (const t of touches) { toques[canal(t.channel)]++; toques.total++; }
  const horas = attributed.map((r) => r.hours_since_last_touch).filter((h): h is number => h !== null);
  return {
    reconvertidos: attributed.length,
    organicos: rows.length - attributed.length,
    receita,
    ticketMedio: attributed.length ? receita / attributed.length : null,
    leadsTocados: tocados,
    taxa: tocados ? attributed.length / tocados : null,
    horasMedias: horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null,
    toques,
  };
}

export function delta(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || !prev) return null;
  return (cur - prev) / prev;
}

export function aggregateReconversao(input: { rows: RecRow[]; touches: TouchRow[]; clicks: ClickRow[]; prevRows: RecRow[]; prevTouches: TouchRow[]; links?: Parameters<typeof aggregateClickRates>[0] }): Agregado {
  const { rows, touches, clicks, prevRows, prevTouches, links } = input;
  const atual = kpis(rows, touches);
  const anterior = kpis(prevRows, prevTouches);
  const attributed = rows.filter((r) => r.attributed);

  const porNivel: Record<Nivel, number> = { cupom: 0, clique: 0, janela: 0 };
  const porNivelReceita: Record<Nivel | 'organico', number> = { cupom: 0, clique: 0, janela: 0, organico: 0 };
  for (const r of rows) {
    if (r.attributed && r.attribution_level) { porNivel[r.attribution_level]++; porNivelReceita[r.attribution_level] += r.order_total ?? 0; }
    else porNivelReceita.organico += r.order_total ?? 0;
  }

  const clicaram = new Set(clicks.filter((c) => c.first_clicked_at && c.people_id).map((c) => c.people_id)).size;

  const porCanalUltimoToque = { email: 0, whatsapp: 0, sms: 0 };
  for (const r of attributed) {
    const canais: Array<['email' | 'whatsapp' | 'sms', number]> = [
      ['email', r.touches_email],
      ['whatsapp', r.touches_whatsapp],
      ['sms', r.touches_sms],
    ];
    const best = canais.sort((a, b) => b[1] - a[1])[0];
    if (best[1] > 0) porCanalUltimoToque[best[0]]++;
  }

  const porDiaMap = new Map<string, { reconversoes: number; receita: number }>();
  for (const r of attributed) {
    const d = r.paid_at.slice(0, 10);
    const cur = porDiaMap.get(d) ?? { reconversoes: 0, receita: 0 };
    cur.reconversoes++; cur.receita += r.order_total ?? 0; porDiaMap.set(d, cur);
  }
  const porDia = [...porDiaMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([dia, v]) => ({ dia, ...v }));

  const cupons = new Map<string, { pedidos: number; receita: number }>();
  for (const r of attributed) {
    if (r.attribution_level !== 'cupom' || !r.coupon_code) continue;
    const c = cupons.get(r.coupon_code) ?? { pedidos: 0, receita: 0 };
    c.pedidos++; c.receita += r.order_total ?? 0; cupons.set(r.coupon_code, c);
  }
  const topCupons = [...cupons.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.receita - a.receita).slice(0, 5);

  return {
    atual, anterior,
    deltas: {
      receita: delta(atual.receita, anterior.receita),
      reconvertidos: delta(atual.reconvertidos, anterior.reconvertidos),
      taxa: delta(atual.taxa, anterior.taxa),
      horas: delta(atual.horasMedias, anterior.horasMedias),
    },
    porNivel, porNivelReceita,
    funil: { tocados: atual.leadsTocados, clicaram, pagaram: atual.reconvertidos },
    porCanalUltimoToque, porDia, topCupons,
    cliquesPorToque: aggregateClickRates(links ?? []),
    ctrGeral: overallClickRate(links ?? []),
  };
}
