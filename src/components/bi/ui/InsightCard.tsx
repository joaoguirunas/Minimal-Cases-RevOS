// src/components/bi/ui/InsightCard.tsx
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeDelta } from '@/lib/bi/period';
import { sparkPercents } from '@/lib/bi/insight';

export function InsightCard({ label, value, cur, prev, invert, spark, note, sub, hint }: {
  label: string; value: string; cur?: number | null; prev?: number | null; invert?: boolean;
  spark?: number[]; note?: string | null; sub?: string; hint?: string;
}) {
  const d = safeDelta(cur, prev);
  const good = d == null ? null : invert ? d < 0 : d > 0;
  const bars = spark && spark.length > 1 ? sparkPercents(spark.slice(-14)) : null;
  return (
    <div title={hint} className="rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/20 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight">{value}</p>
        </div>
        {bars && (
          <span aria-hidden className="flex h-8 items-end gap-[2px] shrink-0">
            {bars.map((p, i) => (
              <span key={i} className={cn('w-[3px] rounded-sm', i === bars.length - 1 ? 'bg-foreground' : 'bg-foreground/15')}
                style={{ height: `${Math.max(12, p)}%` }} />
            ))}
          </span>
        )}
      </div>
      {d != null && d !== 0 && (
        <p className={cn('mt-1.5 flex items-center gap-1 text-[11px] tabular-nums', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {d > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {d > 0 ? '+' : '−'}{Math.abs(d * 100).toFixed(1).replace('.', ',')}% vs comparação
        </p>
      )}
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
      {note && (
        <p className="mt-2 flex items-start gap-1.5 border-t border-border/60 pt-2 text-[11.5px] leading-snug text-muted-foreground">
          <Sparkles className="mt-0.5 size-3 shrink-0" />{note}
        </p>
      )}
    </div>
  );
}
