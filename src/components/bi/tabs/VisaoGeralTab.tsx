// src/components/bi/tabs/VisaoGeralTab.tsx
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { KpiCard } from '../KpiCard';
import { useBiRpc } from '@/hooks/useBiRpc';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

type K = Record<string, number | null>;
interface Overview { kpis: { cur: K; cmp: K }; daily: { day: string; organico: number; influenciado: number; recuperado: number; cmp_total: number }[];
  payment_mix: { method: string; orders: number; revenue: number }[]; device_mix: { device: string; orders: number; revenue: number }[];
  top_states: { state: string; orders: number; revenue: number }[]; alerts: { level: string; text: string }[] }
const PAY: Record<string, string> = { pix: 'Pix', pix_parcelado: 'Pix parcelado', credit_card: 'Cartão', billet: 'Boleto', wallet: 'Carteira', other: 'Outros' };
const pct = (a?: number | null, b?: number | null) => (a != null && b ? `${((a / b) * 100).toFixed(1)}%` : '—');

export default function VisaoGeralTab({ from, to, cmpFrom, cmpTo }: { from: Date; to: Date; cmpFrom: Date; cmpTo: Date }) {
  const { data, isLoading, error } = useBiRpc<Overview>('bi_overview', { p_from: from.toISOString(), p_to: to.toISOString(), p_cmp_from: cmpFrom.toISOString(), p_cmp_to: cmpTo.toISOString() });
  if (error) return <p className="text-[13px] text-red-500">Erro ao carregar: {(error as Error).message}</p>;
  if (isLoading || !data) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  const c = data.kpis.cur, p = data.kpis.cmp;
  const spark = (k: 'organico' | 'influenciado' | 'recuperado' | 'total') => data.daily.map((d) => k === 'total' ? d.organico + d.influenciado + d.recuperado : d[k]);
  return (
    <div className="space-y-5">
      {data.alerts.length > 0 && (
        <div className="space-y-1.5">{data.alerts.map((a, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-[12px] ${a.level === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600'}`}>⚠ {a.text}</div>))}</div>)}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento bruto" value={fmtBRL(c.gross ?? 0)} cur={c.gross} prev={p.gross} spark={spark('total')} />
        <KpiCard label="Faturamento líquido" value={fmtBRL(c.net ?? 0)} cur={c.net} prev={p.net} sub="sem cancelados e estornados" />
        <KpiCard label="Pedidos pagos" value={String(c.orders ?? 0)} cur={c.orders} prev={p.orders} />
        <KpiCard label="Ticket médio" value={c.aov != null ? fmtBRL(c.aov) : '—'} cur={c.aov} prev={p.aov} />
        <KpiCard label="Recuperado com prova (7d)" value={fmtBRL(c.recovered_revenue ?? 0)} cur={c.recovered_revenue} prev={p.recovered_revenue}
          sub={`${c.recovered_orders ?? 0} pedidos · ${c.recovered_share != null ? (c.recovered_share * 100).toFixed(1) : '0'}% do faturamento`} spark={spark('recuperado')}
          hint="Pedidos com nosso cupom, clique em link nosso até 7 dias antes de pagar, ou fechados pelo comercial." />
        <KpiCard label="Influenciado (7d)" value={fmtBRL(c.influenced_revenue ?? 0)} cur={c.influenced_revenue} prev={p.influenced_revenue}
          sub={`${c.influenced_orders ?? 0} pedidos · fora da conta de recuperados`} hint="Recebeu mensagem até 7 dias antes de pagar, sem cupom ou clique." />
        <KpiCard label="Aprovação Pix" value={pct(c.pix_paid, c.pix_generated)} cur={c.pix_generated ? (c.pix_paid ?? 0) / c.pix_generated : null} prev={p.pix_generated ? (p.pix_paid ?? 0) / p.pix_generated : null}
          sub={`${c.pix_paid ?? 0} pagos de ${c.pix_generated ?? 0} gerados · boleto ${pct(c.billet_paid, c.billet_generated)} · cartão ${pct(c.card_paid, c.card_attempts)}`} />
        <KpiCard label="Clientes novos × recorrentes" value={pct(c.new_revenue, (c.new_revenue ?? 0) + (c.returning_revenue ?? 0))}
          sub={`${fmtBRL(c.new_revenue ?? 0)} novos · ${fmtBRL(c.returning_revenue ?? 0)} recorrentes`} />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[13px] font-medium mb-3">Faturamento por dia</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="day" tickFormatter={(d) => d.slice(8, 10) + '/' + d.slice(5, 7)} fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} labelFormatter={(d) => String(d).split('-').reverse().join('/')} />
              <Legend />
              <Bar dataKey="organico" name="Orgânico" stackId="a" fill="#94a3b8" />
              <Bar dataKey="influenciado" name="Influenciado" stackId="a" fill="#f59e0b" />
              <Bar dataKey="recuperado" name="Recuperado" stackId="a" fill="#10b981" />
              <Line dataKey="cmp_total" name="Período de comparação" stroke="#6366f1" dot={false} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { title: 'Forma de pagamento', rows: data.payment_mix.map((r) => ({ k: PAY[r.method] ?? r.method, ...r })) },
          { title: 'Dispositivo', rows: data.device_mix.map((r) => ({ k: r.device === 'mobile' ? 'Celular' : r.device === 'desktop' ? 'Computador' : r.device, ...r })) },
          { title: 'Top 5 estados', rows: data.top_states.map((r) => ({ k: r.state, ...r })) },
        ].map((box) => {
          const total = box.rows.reduce((s, r) => s + Number(r.revenue), 0) || 1;
          return (
            <div key={box.title} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-[13px] font-medium">{box.title}</h3>
              {box.rows.length === 0 ? <p className="text-[12px] text-muted-foreground">Sem dados.</p> : box.rows.map((r) => (
                <div key={r.k} className="space-y-1">
                  <div className="flex justify-between text-[12px]"><span>{r.k}</span><span className="tabular-nums text-muted-foreground">{fmtBRL(Number(r.revenue))} · {r.orders}</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(Number(r.revenue) / total) * 100}%` }} /></div>
                </div>))}
            </div>);
        })}
      </div>
    </div>
  );
}
