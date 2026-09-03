import { Sparkles } from 'lucide-react';
import { buildInsights } from '@/lib/bi/insights';
import type { Agregado } from '@/lib/bi/reconversao';

export default function InsightsStrip({ agregado }: { agregado: Agregado }) {
  const frases = buildInsights(agregado);
  if (frases.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1.5 items-center">
      <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} aria-hidden />
      {frases.map((f) => <p key={f} className="text-[12px] text-foreground">{f}</p>)}
    </div>
  );
}
