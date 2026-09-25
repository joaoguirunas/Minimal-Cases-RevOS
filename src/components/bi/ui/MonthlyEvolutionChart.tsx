// src/components/bi/ui/MonthlyEvolutionChart.tsx
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
type Row = { month: string; new_revenue: number; returning_revenue: number; recuperado: number; influenciado: number };

export function MonthlyEvolutionChart({ data }: { data: Row[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
          <XAxis dataKey="month" fontSize={11} tickFormatter={(m: string) => `${MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`} />
          <YAxis fontSize={11} tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v: number) => fmtBRL(v)} />
          <Legend />
          <Bar dataKey="new_revenue" name="Novos" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
          <Bar dataKey="returning_revenue" name="Recorrentes" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Line dataKey="recuperado" name="Recuperado com prova" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line dataKey="influenciado" name="Influenciado" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
