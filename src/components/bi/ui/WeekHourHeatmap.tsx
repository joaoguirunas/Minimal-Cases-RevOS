// src/components/bi/ui/WeekHourHeatmap.tsx
import { Fragment } from 'react';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
type Cell = { dow: number; hour: number; orders: number; revenue: number };

export function WeekHourHeatmap({ cells }: { cells: Cell[] }) {
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c]));
  const max = Math.max(1, ...cells.map((c) => c.orders));
  const byDay = DIAS.map((_, d) => cells.filter((c) => c.dow === d).reduce((s, c) => s + c.orders, 0));
  const best = byDay.indexOf(Math.max(...byDay));
  if (cells.length === 0) return <p className="text-[12px] text-muted-foreground py-6 text-center">Sem vendas no período.</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="grid gap-[2px] min-w-[560px]" style={{ gridTemplateColumns: '36px repeat(24, minmax(0, 1fr)) 48px' }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-[9px] text-center text-muted-foreground">{h % 3 === 0 ? `${h}h` : ''}</span>)}
          <span className="text-[9px] text-right text-muted-foreground">pedidos</span>
          {DIAS.map((dia, d) => (
            <Fragment key={d}>
              <span className={`text-[11px] ${d === best ? 'font-semibold' : 'text-muted-foreground'}`}>{dia}</span>
              {Array.from({ length: 24 }, (_, h) => {
                const c = grid.get(`${d}-${h}`);
                const v = c?.orders ?? 0;
                return <span key={`${d}-${h}`} className="h-5 rounded-[3px]"
                  title={`${dia} ${h}h: ${v} pedidos${c ? ` · ${fmtBRL(c.revenue)}` : ''}`}
                  style={{ background: v ? `rgba(16, 185, 129, ${0.1 + (v / max) * 0.85})` : 'hsl(var(--muted))' }} />;
              })}
              <span className="text-[11px] text-right tabular-nums text-muted-foreground">{byDay[d]}</span>
            </Fragment>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Melhor dia: <b className="text-foreground">{DIAS[best]}</b> · horário de São Paulo.</p>
    </div>
  );
}
