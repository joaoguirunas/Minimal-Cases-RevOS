// src/components/bi/tabs/RecompraTab.tsx
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useBiRpc } from '@/hooks/useBiRpc';
import { InsightCard } from '../ui/InsightCard';
import { CohortGrid } from '../ui/CohortGrid';
import { DataTable } from '../DataTable';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

interface Recompra {
  customers: number; repurchase_rate: number | null; avg_frequency: number | null; median_days_to_2nd: number | null; avg_days_between: number | null;
  distribution: { bucket: number; customers: number }[];
  top: { customer_id: number; name: string | null; people_id: string | null; orders: number; revenue: number; lifetime_orders: number }[];
  cohorts: { month: string; size: number; retention: number[] }[];
}
const n1 = (v: number | null) => (v == null ? '—' : v.toFixed(1).replace('.', ','));

export default function RecompraTab({ from, to }: { from: Date; to: Date }) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useBiRpc<Recompra>('bi_recompra', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) return <p className="text-[13px] text-red-500">Erro ao carregar: {(error as Error).message}</p>;
  if (isLoading || !data) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  if (data.customers === 0) return <p className="text-[13px] text-muted-foreground py-10 text-center">Nenhuma venda no período.</p>;
  const dist = data.distribution.map((d) => ({ k: d.bucket >= 4 ? '4+ pedidos' : `${d.bucket} pedido${d.bucket > 1 ? 's' : ''}`, v: d.customers }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InsightCard label="Taxa de recompra" value={data.repurchase_rate == null ? '—' : `${n1(data.repurchase_rate * 100)}%`}
          note={`${data.customers.toLocaleString('pt-BR')} clientes compraram no período; esta % já comprou 2+ vezes na vida`} />
        <InsightCard label="Frequência média" value={`${n1(data.avg_frequency)} pedidos`} note="Pedidos na vida, por cliente do período" />
        <InsightCard label="Tempo até a 2ª compra" value={data.median_days_to_2nd == null ? '—' : `${Math.round(data.median_days_to_2nd)} dias`} note="Mediana entre a 1ª e a 2ª compra" />
        <InsightCard label="Tempo entre compras" value={data.avg_days_between == null ? '—' : `${Math.round(data.avg_days_between)} dias`} note="Média de dias entre pedidos de quem recompra" />
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[13px] font-medium mb-3">Clientes por nº de pedidos</h3>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={dist}><XAxis dataKey="k" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="v" name="Clientes" fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h3 className="text-[13px] font-medium mb-3">Top 5 clientes do período</h3>
          <DataTable rows={data.top} onRowClick={(r) => r.people_id && navigate(`/omni?pessoaId=${r.people_id}`)} columns={[
            { key: 'name', label: 'Cliente', format: (v) => v ?? '—' },
            { key: 'orders', label: 'Pedidos no período', align: 'right' },
            { key: 'lifetime_orders', label: 'Pedidos na vida', align: 'right' },
            { key: 'revenue', label: 'Receita no período', align: 'right', format: (v) => fmtBRL(Number(v)) },
          ]} />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[13px] font-medium mb-3">Coortes de recompra (últimos 12 meses)</h3>
        <CohortGrid cohorts={data.cohorts} />
      </div>
    </div>
  );
}
