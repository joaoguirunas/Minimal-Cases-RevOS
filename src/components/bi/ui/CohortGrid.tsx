// src/components/bi/ui/CohortGrid.tsx
import { useMemo, useState } from 'react';

type Cohort = { month: string; size: number; retention: number[] };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const label = (m: string) => `${MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

export function CohortGrid({ cohorts }: { cohorts: Cohort[] }) {
  const [hov, setHov] = useState<{ r: number; c: number } | null>(null);
  const periods = Math.max(0, ...cohorts.map((c) => c.retention.length - 1));
  const max = useMemo(() => Math.max(1, ...cohorts.flatMap((c) => c.retention.slice(1))), [cohorts]);
  const avg = useMemo(() => Array.from({ length: periods }, (_, i) => {
    const vals = cohorts.map((c) => c.retention[i + 1]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }), [cohorts, periods]);
  if (cohorts.length === 0) return <p className="text-[12px] text-muted-foreground py-6 text-center">Sem coortes no período.</p>;
  const bg = (v: number) => `rgba(16, 185, 129, ${0.08 + (v / max) * 0.8})`;
  const fmt = (v: number) => v.toFixed(1).replace('.', ',');
  return (
    <div className="overflow-x-auto" onPointerLeave={() => setHov(null)}>
      <table className="text-[11px] tabular-nums border-separate border-spacing-[2px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium pr-2">1ª compra</th>
            <th className="text-right font-medium pr-2">Clientes</th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} className={`w-12 font-medium ${hov?.c === i ? 'text-foreground' : ''}`}>+{i + 1}m</th>))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c, r) => (
            <tr key={c.month}>
              <td className={`pr-2 whitespace-nowrap ${hov?.r === r ? 'text-foreground' : 'text-muted-foreground'}`}>{label(c.month)}</td>
              <td className="pr-2 text-right text-muted-foreground">{c.size.toLocaleString('pt-BR')}</td>
              {Array.from({ length: periods }, (_, i) => {
                const v = c.retention[i + 1];
                const cross = hov && (hov.r === r || hov.c === i);
                return v == null ? <td key={i} /> : (
                  <td key={i} onPointerEnter={() => setHov({ r, c: i })} title={`${label(c.month)} · mês ${i + 1}: ${fmt(v)}% voltaram`}
                    className="h-7 w-12 rounded text-center font-medium" style={{ background: bg(v), opacity: hov && !cross ? 0.45 : 1 }}>
                    {fmt(v)}
                  </td>);
              })}
            </tr>
          ))}
          <tr>
            <td className="pr-2 pt-1 font-semibold">Média</td><td />
            {avg.map((v, i) => <td key={i} className="pt-1 text-center font-semibold">{v == null ? '' : fmt(v)}</td>)}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">% dos clientes de cada mês de 1ª compra que compraram de novo N meses depois.</p>
    </div>
  );
}
