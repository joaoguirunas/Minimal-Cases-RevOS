// src/components/bi/tabs/VisaoGeralTab.tsx
import { Bar, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { InsightCard } from '../ui/InsightCard';
import { MonthlyEvolutionChart } from '../ui/MonthlyEvolutionChart';
import { WeekHourHeatmap } from '../ui/WeekHourHeatmap';
import { useBiRpc } from '@/hooks/useBiRpc';
import { fmtBRL } from '@/components/dashboard/bipro-shared';
import { driverNote, roiLabel } from '@/lib/bi/insight';

type K = Record<string, number | null>;
interface Overview {
  kpis: { cur: K; cmp: K };
  daily: { day: string; organico: number; influenciado: number; recuperado: number; cmp_total: number }[];
  monthly: { month: string; new_revenue: number; returning_revenue: number; recuperado: number; influenciado: number; orders: number }[];
  weekday_hour: { dow: number; hour: number; orders: number; revenue: number }[];
  by_source: { channel: string; recovered_orders: number; recovered_revenue: number; influenced_orders: number; influenced_revenue: number }[];
  payment_mix: { method: string; orders: number; revenue: number }[]; device_mix: { device: string; orders: number; revenue: number }[];
  top_states: { state: string; orders: number; revenue: number }[]; alerts: { level: string; text: string }[];
}
const PAY: Record<string, string> = { pix: 'Pix', pix_parcelado: 'Pix parcelado', credit_card: 'Cartão', billet: 'Boleto', wallet: 'Carteira', other: 'Outros' };
const CANAL: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', comercial: 'Comercial', agente: 'Agente IA', outro: 'Outro' };
const pct = (a?: number | null, b?: number | null) => (a != null && b ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '—');
const brl = (v?: number | null) => fmtBRL(Number(v ?? 0));

export default function VisaoGeralTab({ from, to, cmpFrom, cmpTo }: { from: Date; to: Date; cmpFrom: Date; cmpTo: Date }) {
  const { data, isLoading, error } = useBiRpc<Overview>('bi_overview', { p_from: from.toISOString(), p_to: to.toISOString(), p_cmp_from: cmpFrom.toISOString(), p_cmp_to: cmpTo.toISOString() });
  if (error) return <p className="text-[13px] text-red-500">Erro ao carregar: {(error as Error).message}</p>;
  if (isLoading || !data) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />)}</div>
      <div className="h-72 rounded-xl bg-muted/50 animate-pulse" />
    </div>);
  const c = data.kpis.cur, p = data.kpis.cmp;
  const spark = (k: 'organico' | 'influenciado' | 'recuperado' | 'total') => data.daily.map((d) => k === 'total' ? d.organico + d.influenciado + d.recuperado : d[k]);
  const roi = roiLabel(c.retention_roi, c.crm_cost, Boolean((c as Record<string, unknown>).fixed_cost_configured));
  const gross = Number(c.gross ?? 0);
  return (
    <div className="space-y-5">
      {data.alerts.length > 0 && (
        <div className="space-y-1.5">{data.alerts.map((a, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-[12px] ${a.level === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600'}`}>⚠ {a.text}</div>))}</div>)}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InsightCard label="Receita total" value={brl(c.gross)} cur={c.gross} prev={p.gross} spark={spark('total')}
          note={driverNote([{ label: 'novos clientes', cur: Number(c.new_revenue ?? 0), prev: Number(p.new_revenue ?? 0) },
            { label: 'recorrentes', cur: Number(c.returning_revenue ?? 0), prev: Number(p.returning_revenue ?? 0) }])} />
        <InsightCard label="Receita CRM" value={brl(c.crm_revenue)} cur={c.crm_revenue} prev={p.crm_revenue}
          spark={data.daily.map((d) => d.recuperado + d.influenciado)}
          sub={`${brl(c.recovered_revenue)} recuperado com prova · ${brl(c.influenced_revenue)} influenciado`}
          note={`${pct(c.crm_revenue, gross)} da receita da loja`}
          hint="Recuperado: nosso cupom, clique em link nosso até 7 dias antes de pagar, ou fechado pelo comercial. Influenciado: recebeu mensagem até 7 dias antes, sem cupom ou clique." />
        <InsightCard label="Vendas" value={String(c.orders ?? 0)} cur={c.orders} prev={p.orders}
          note={`Ticket médio ${brl(c.aov)}`} />
        <InsightCard label="Ticket médio" value={c.aov != null ? brl(c.aov) : '—'} cur={c.aov} prev={p.aov} />
        <InsightCard label="ROI de retenção" value={roi.value} cur={c.retention_roi} prev={p.retention_roi} note={roi.note}
          hint="Recuperado com prova ÷ (custo das mensagens de WhatsApp + custo mensal do CRM proporcional ao período)." />
        <InsightCard label="Retenção" value={c.retention_share != null ? `${(Number(c.retention_share) * 100).toFixed(1).replace('.', ',')}%` : '—'}
          cur={c.retention_share} prev={p.retention_share} sub={`${brl(c.returning_revenue)} de clientes recorrentes`}
          note="Parte da receita vinda de quem já tinha comprado antes" />
        <InsightCard label="LTV" value={brl(c.ltv)} cur={c.ltv} prev={p.ltv}
          sub={c.ltv_12m ? `Em 12 meses após a 1ª compra: ${brl(c.ltv_12m)}` : undefined}
          note="Receita média por cliente desde o início do histórico" />
        <InsightCard label="Recuperado com prova (7d)" value={brl(c.recovered_revenue)} cur={c.recovered_revenue} prev={p.recovered_revenue}
          spark={spark('recuperado')} sub={`${c.recovered_orders ?? 0} pedidos · ${pct(c.recovered_revenue, gross)} da receita`} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[13px] font-medium mb-3">Evolução de vendas — últimos 12 meses</h3>
        <MonthlyEvolutionChart data={data.monthly} />
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

      <div className="grid lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3 min-w-0">
          <h3 className="text-[13px] font-medium mb-3">Vendas por dia da semana e hora</h3>
          <WeekHourHeatmap cells={data.weekday_hour} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2 min-w-0">
          <h3 className="text-[13px] font-medium mb-3">Receita CRM por fonte</h3>
          {data.by_source.length === 0 ? <p className="text-[12px] text-muted-foreground py-6 text-center">Nenhuma venda do CRM no período.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] tabular-nums">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 text-left font-medium">Canal</th>
                  <th className="py-2 text-right font-medium">Recuperado</th>
                  <th className="py-2 text-right font-medium">Influenciado</th>
                  <th className="py-2 text-right font-medium">% receita</th>
                </tr></thead>
                <tbody>{data.by_source.map((s) => (
                  <tr key={s.channel} className="border-b border-border/40">
                    <td className="py-2">{CANAL[s.channel] ?? s.channel}</td>
                    <td className="py-2 text-right">{brl(s.recovered_revenue)}<span className="text-muted-foreground"> · {s.recovered_orders}</span></td>
                    <td className="py-2 text-right">{brl(s.influenced_revenue)}<span className="text-muted-foreground"> · {s.influenced_orders}</span></td>
                    <td className="py-2 text-right">{pct(Number(s.recovered_revenue) + Number(s.influenced_revenue), gross)}</td>
                  </tr>))}</tbody>
              </table>
            </div>)}
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
