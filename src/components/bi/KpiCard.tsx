// src/components/bi/KpiCard.tsx
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { safeDelta } from '@/lib/bi/period';
import { chartTheme } from '@/lib/chartTheme';
export function KpiCard({ label, value, cur, prev, invert, sub, spark, hint }: { label: string; value: string; cur?: number | null; prev?: number | null; invert?: boolean; sub?: string; spark?: number[]; hint?: string }) {
  const d = safeDelta(cur, prev);
  const good = d == null ? null : invert ? d < 0 : d > 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5" title={hint}>
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tabular-nums">{value}</span>
        {d != null && (
          <span className={`text-[12px] font-medium tabular-nums ${good ? 'text-emerald-500' : 'text-red-500'}`}>
            {d > 0 ? '▲' : '▼'} {Math.abs(d * 100).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      {spark && spark.length > 1 && (
        <div className="h-8 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey="v" stroke={chartTheme.colors.primary} strokeWidth={1.5} fill={chartTheme.colors.primary} fillOpacity={0.08} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
