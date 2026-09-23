// src/components/bi/tabs/EsteiraTab.tsx
import { useBiRpc } from '@/hooks/useBiRpc';
import { DataTable } from '../DataTable';
import { KpiCard } from '../KpiCard';
import AbTestCard from '@/components/dashboard/reconversao/AbTestCard';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

interface Est { touches: { template: string; channel: string; sent: number; delivered: number; read: number; clicks: number; ctr: number | null; recovered_orders: number; revenue: number; rpr: number | null; cost: number; roi: number | null }[];
  channels: { channel: string; sent: number; clicks: number; recovered_orders: number; revenue: number; cost: number }[];
  coupons: { created: number; used: number; use_rate: number | null; revenue: number };
  wa_health: { sent: number; delivered: number; read: number; errors: { code: string | null; title: string | null; count: number }[] } }
const pct = (v: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : '—');
const ERR: Record<string, string> = { '131049': 'Limite de marketing da Meta', '131026': 'Número sem WhatsApp', '130472': 'Bloqueado pela Meta (teste)' };

export default function EsteiraTab({ from, to, isAdmin }: { from: Date; to: Date; isAdmin: boolean }) {
  const { data, isLoading, error } = useBiRpc<Est>('bi_esteira', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) return <p className="text-[13px] text-red-500">Erro ao carregar: {(error as Error).message}</p>;
  if (isLoading || !data) return <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />;
  const w = data.wa_health;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.channels.map((c) => (
          <KpiCard key={c.channel} label={c.channel === 'email' ? 'E-mail' : 'WhatsApp'} value={fmtBRL(Number(c.revenue))}
            sub={`${c.sent} enviados · ${c.clicks} cliques · ${c.recovered_orders} vendas · custo ${fmtBRL(Number(c.cost))}`} />))}
        <KpiCard label="Cupons pessoais" value={`${data.coupons.used} de ${data.coupons.created}`} sub={`uso ${pct(data.coupons.use_rate)} · ${fmtBRL(Number(data.coupons.revenue))}`} />
        <KpiCard label="Entrega do WhatsApp" value={pct(w.sent ? w.delivered / w.sent : null)} sub={`${w.delivered} de ${w.sent} · ${w.read} lidos`} />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="text-[13px] font-medium">Desempenho por toque</h3>
        <DataTable csvName="esteira-por-toque.csv" rows={data.touches} columns={[
          { key: 'template', label: 'Toque' }, { key: 'channel', label: 'Canal', format: (v) => (v === 'email' ? 'E-mail' : 'WhatsApp') },
          { key: 'sent', label: 'Enviados', align: 'right' }, { key: 'delivered', label: 'Entregues', align: 'right' }, { key: 'read', label: 'Lidos', align: 'right' },
          { key: 'clicks', label: 'Cliques', align: 'right' }, { key: 'ctr', label: 'CTR', align: 'right', format: pct },
          { key: 'recovered_orders', label: 'Vendas', align: 'right' }, { key: 'revenue', label: 'R$', align: 'right', format: (v) => fmtBRL(Number(v)) },
          { key: 'rpr', label: 'R$/entregue', align: 'right', format: (v) => (v != null ? fmtBRL(Number(v)) : '—') },
          { key: 'cost', label: 'Custo', align: 'right', format: (v) => fmtBRL(Number(v)) },
          { key: 'roi', label: 'ROI', align: 'right', format: (v) => (v != null ? `${Number(v).toFixed(1)}×` : '—') }]} />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="text-[13px] font-medium">Erros de entrega do WhatsApp</h3>
        <DataTable rows={w.errors} empty="Nenhum erro no período." columns={[
          { key: 'code', label: 'Código' }, { key: 'title', label: 'Motivo', format: (v, r) => ERR[r.code ?? ''] ?? v ?? '—' }, { key: 'count', label: 'Mensagens', align: 'right' }]} />
      </div>
      {isAdmin && <AbTestCard />}
    </div>
  );
}
