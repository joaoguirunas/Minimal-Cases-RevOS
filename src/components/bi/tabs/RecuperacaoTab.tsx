// src/components/bi/tabs/RecuperacaoTab.tsx
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useBiRpc } from '@/hooks/useBiRpc';
import { FunnelChart } from '../FunnelChart';
import { DataTable } from '../DataTable';
import { KpiCard } from '../KpiCard';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

interface Rec { funnel: { step: string; value: number }[]; by_type: { type: string; eligible: number; recovered: number; revenue: number }[];
  time_buckets: { bucket: string; orders: number }[]; median_hours: number | null; by_channel: { channel: string; orders: number; revenue: number }[];
  queue: { people_id: string; name: string; kind: string; value: number | null; age_hours: number; next_touch: string | null; next_at: string | null }[];
  orders: { order_id: number; name: string | null; paid_at: string; value: number; proof: string; channel: string | null; template: string | null; coupon: string | null; hours: number | null }[] }
const TYPE: Record<string, string> = { carrinho: 'Carrinho abandonado', pix: 'Pix não pago', boleto: 'Boleto não pago', cartao_recusado: 'Cartão recusado' };
const CH: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', comercial: 'Comercial' };
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export default function RecuperacaoTab({ from, to }: { from: Date; to: Date }) {
  const nav = useNavigate();
  const { data, isLoading, error } = useBiRpc<Rec>('bi_recuperacao', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) return <p className="text-[13px] text-red-500">Erro ao carregar: {(error as Error).message}</p>;
  if (isLoading || !data) return <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.by_type.map((t) => (
          <KpiCard key={t.type} label={TYPE[t.type] ?? t.type} value={fmtBRL(Number(t.revenue))}
            sub={`${t.recovered} recuperados de ${t.eligible} · ${t.eligible ? ((t.recovered / t.eligible) * 100).toFixed(1) : '0'}%`} />))}
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3"><h3 className="text-[13px] font-medium">Funil da recuperação</h3><FunnelChart steps={data.funnel} /></div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-[13px] font-medium">Tempo até recuperar {data.median_hours != null && <span className="text-muted-foreground font-normal">· mediana {Number(data.median_hours).toFixed(1)} h</span>}</h3>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.time_buckets}><XAxis dataKey="bucket" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Bar dataKey="orders" name="Pedidos" fill="#10b981" /></BarChart>
          </ResponsiveContainer></div>
          <div className="flex gap-4 text-[12px]">{data.by_channel.map((c) => <span key={c.channel}>{CH[c.channel] ?? c.channel}: <b>{c.orders}</b> · {fmtBRL(Number(c.revenue))}</span>)}</div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="text-[13px] font-medium">Pedidos recuperados</h3>
        <DataTable csvName="recuperados.csv" rows={data.orders} columns={[
          { key: 'paid_at', label: 'Pago em', format: dt }, { key: 'name', label: 'Cliente' }, { key: 'value', label: 'Valor', align: 'right', format: (v) => fmtBRL(Number(v)) },
          { key: 'proof', label: 'Prova', format: (v, r) => v === 'cupom' ? `Cupom ${r.coupon ?? ''}` : v === 'clique' ? 'Clique' : 'Comercial' },
          { key: 'channel', label: 'Canal', format: (v) => CH[v] ?? '—' }, { key: 'template', label: 'Toque' },
          { key: 'hours', label: 'Horas até pagar', align: 'right', format: (v) => (v != null ? String(v) : '—') }]} />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="text-[13px] font-medium">Fila ao vivo · {data.queue.length} em recuperação</h3>
        <DataTable csvName="fila-recuperacao.csv" rows={data.queue} onRowClick={(r) => nav(`/omni?pessoaId=${r.people_id}`)} columns={[
          { key: 'name', label: 'Cliente' }, { key: 'kind', label: 'Tipo' }, { key: 'value', label: 'Valor', align: 'right', format: (v) => (v != null ? fmtBRL(Number(v)) : '—') },
          { key: 'age_hours', label: 'Idade', align: 'right', format: (v) => (v >= 48 ? `${Math.round(v / 24)} d` : `${v} h`) },
          { key: 'next_touch', label: 'Próximo toque' }, { key: 'next_at', label: 'Quando', format: dt }]} />
      </div>
    </div>
  );
}
