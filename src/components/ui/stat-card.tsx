import type { ElementType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatDelta { value: number | null; label?: string; invert?: boolean }
export interface StatCardProps {
  size?: 'hero' | 'default' | 'compact';
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: StatDelta;
  icon?: ElementType;
  children?: ReactNode; // slot (sparkline, mini barra)
  className?: string;
}

function DeltaBadge({ delta }: { delta: StatDelta }) {
  if (delta.value === null || !Number.isFinite(delta.value)) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" strokeWidth={1.5} />sem base</span>;
  }
  const up = delta.value > 0.005;
  const down = delta.value < -0.005;
  const good = delta.invert ? down : up;
  const bad = delta.invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  // Sinal segue os mesmos booleanos up/down do ícone e da cor: dentro da zona morta
  // (|value| < 0.005) o texto é exatamente "0%", nunca "+0%" nem "-0%".
  const magnitude = Math.abs(delta.value * 100).toFixed(0);
  const pct = up ? `+${magnitude}%` : down ? `-${magnitude}%` : '0%';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium tabular-nums',
      good ? 'text-emerald-500' : bad ? 'text-red-500' : 'text-muted-foreground')}>
      <Icon className="h-3 w-3" strokeWidth={1.75} />{pct}
      {delta.label ? <span className="font-normal text-muted-foreground">{delta.label}</span> : null}
    </span>
  );
}

export function StatCard({ size = 'default', label, value, sub, delta, icon: Icon, children, className }: StatCardProps) {
  const valueCls = size === 'hero' ? 'text-[40px] leading-none' : size === 'compact' ? 'text-[20px] leading-tight' : 'text-[28px] leading-none';
  return (
    <div className={cn('rounded-xl border border-border bg-card flex flex-col', size === 'compact' ? 'p-4 gap-1.5' : 'p-5 gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} aria-hidden /> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className={cn('font-semibold tabular-nums text-foreground', valueCls)}>{value}</span>
        {delta ? <DeltaBadge delta={delta} /> : null}
      </div>
      {sub ? <div className="text-[12px] text-muted-foreground leading-snug">{sub}</div> : null}
      {children}
    </div>
  );
}
