// src/lib/bi/insight.ts
/** Frases automáticas dos cartões (o "note" do Insight Card). */
const pct1 = (v: number) => (Math.abs(v) * 100).toFixed(1).replace('.', ',');

/** "▲ 15,0% vs comparação, puxado por X" — X = parte com a maior variação na mesma direção do total. */
export function driverNote(parts: { label: string; cur: number; prev: number }[]): string | null {
  const cur = parts.reduce((s, p) => s + p.cur, 0);
  const prev = parts.reduce((s, p) => s + p.prev, 0);
  if (!prev) return null;
  const d = (cur - prev) / prev;
  if (d === 0) return 'Estável vs comparação';
  const up = d > 0;
  const top = [...parts].sort((a, b) => (up ? (b.cur - b.prev) - (a.cur - a.prev) : (a.cur - a.prev) - (b.cur - b.prev)))[0];
  return `${up ? '▲' : '▼'} ${pct1(d)}% vs comparação, puxado por ${top.label}`;
}

/** ROI de retenção. Sem o custo fixo do CRM configurado, o número considera só as mensagens — e o cartão avisa. */
export function roiLabel(roi: number | null | undefined, cost: number | null | undefined, fixedCostConfigured = false): { value: string; note: string } {
  if (roi == null || !cost) return { value: '—', note: 'Configure o custo mensal do CRM para ver o ROI.' };
  const custo = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(cost);
  // arredonda meio para cima (8,85 → 8,9); toFixed sozinho erra pela representação binária
  const value = `${(Math.round(roi * 10 + 1e-9) / 10).toFixed(1).replace('.', ',')}x`;
  if (!fixedCostConfigured) return { value, note: `Só o custo das mensagens (${custo}). Configure o custo mensal do CRM para o ROI real.` };
  return { value, note: `Cada R$ 1 investido voltou R$ ${roi.toFixed(2).replace('.', ',')} (custo ${custo})` };
}

export function sparkPercents(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max ? Math.round((v / max) * 100) : 0));
}
