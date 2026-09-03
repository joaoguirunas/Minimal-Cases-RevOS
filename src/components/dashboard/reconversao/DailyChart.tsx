import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import { chartTheme } from '@/lib/chartTheme';
import type { Agregado } from '@/lib/bi/reconversao';

export default function DailyChart({ porDia }: { porDia: Agregado['porDia'] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[13px] font-medium text-foreground">Reconversões e receita por dia</p>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-muted-foreground/30 mr-1" />receita</span>
          <span><span className="inline-block w-2 h-0.5 bg-primary mr-1 align-middle" />reconversões</span>
        </div>
      </div>
      {porDia.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-10 text-center">Nenhuma reconversão atribuída no período. Dispare a esteira e volte aqui — cada pedido pago após um toque aparece neste gráfico.</p>
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={porDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} vertical={false} />
              <XAxis dataKey="dia" tickFormatter={(d: string) => format(new Date(`${d}T12:00:00`), 'dd/MM')} tick={chartTheme.axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rec" allowDecimals={false} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={28} />
              <YAxis yAxisId="rev" orientation="right" tickFormatter={(v: number) => `R$${Math.round(v / 100) / 10}k`} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={chartTheme.tooltipStyle} labelStyle={chartTheme.tooltipLabelStyle}
                formatter={(value: number, name: string) => (name === 'receita' ? [fmtBRL(value), 'Receita'] : [value, 'Reconversões'])}
                labelFormatter={(d: string) => format(new Date(`${d}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })} />
              <Bar yAxisId="rev" dataKey="receita" fill={chartTheme.colors.muted} fillOpacity={0.25} radius={[6, 6, 0, 0]} />
              <Line yAxisId="rec" type="monotone" dataKey="reconversoes" stroke={chartTheme.colors.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: chartTheme.colors.primary }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
