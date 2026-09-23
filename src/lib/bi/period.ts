// src/lib/bi/period.ts
export type PeriodKey = 'today' | '7d' | '30d' | '90d' | 'month' | 'last-month' | 'custom';
export type CompareKey = 'previous' | 'year';
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export function resolvePeriod(key: PeriodKey, custom?: { from: Date; to: Date }, nowIn = new Date()): { from: Date; to: Date } {
  // "Até agora" arredondado para o minuto: a chave do cache não muda a cada render.
  const now = new Date(nowIn); now.setSeconds(0, 0);
  const back = (n: number) => { const f = day0(now); f.setDate(f.getDate() - n); return { from: f, to: now }; };
  switch (key) {
    case 'today': return { from: day0(now), to: now };
    case '7d': return back(7);
    case '90d': return back(90);
    case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'last-month': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'custom': if (custom) { const to = day0(custom.to); to.setDate(to.getDate() + 1); return { from: day0(custom.from), to }; } return back(30);
    case '30d': default: return back(30);
  }
}
export function comparePeriod(p: { from: Date; to: Date }, mode: CompareKey) {
  if (mode === 'year') {
    const f = new Date(p.from); f.setFullYear(f.getFullYear() - 1);
    const t = new Date(p.to); t.setFullYear(t.getFullYear() - 1);
    return { from: f, to: t };
  }
  const span = p.to.getTime() - p.from.getTime();
  return { from: new Date(p.from.getTime() - span), to: new Date(p.from) };
}
export function safeDelta(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return (cur - prev) / prev;
}
