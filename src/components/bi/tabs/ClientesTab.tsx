// src/components/bi/tabs/ClientesTab.tsx
import { useState } from 'react';
import { useBiRpc } from '@/hooks/useBiRpc';
import { RfmTreemap } from '../ui/RfmTreemap';
import { CustomersTable } from '../CustomersTable';
import { segmentMeta } from '@/lib/bi/segments';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

interface Rfm { total: number; refreshed_at: string | null; segments: { segment: string; customers: number; share: number; revenue: number; avg_ticket: number; avg_recency_days: number }[] }

export default function ClientesTab() {
  const { data, isLoading, error } = useBiRpc<Rfm>('bi_rfm', {});
  const [segment, setSegment] = useState<string | null>(null);
  if (error) return <p className="text-[13px] text-red-500">Erro ao carregar: {(error as Error).message}</p>;
  if (isLoading || !data) return <div className="h-80 rounded-xl bg-muted/50 animate-pulse" />;
  const sel = data.segments.find((s) => s.segment === segment);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-medium">Matriz RFM · {data.total.toLocaleString('pt-BR')} clientes</h3>
          <span className="text-[11px] text-muted-foreground">Área = nº de clientes · clique para filtrar a lista</span>
        </div>
        <RfmTreemap segments={data.segments} selected={segment} onSelect={setSegment} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {data.segments.map((s) => (
          <button key={s.segment} onClick={() => setSegment(segment === s.segment ? null : s.segment)}
            className={`rounded-lg border p-2.5 text-left transition-colors ${segment === s.segment ? 'border-foreground' : 'border-border hover:border-foreground/30'} bg-card`}>
            <span className="flex items-center gap-1.5 text-[11px] font-medium"><span className="size-2 rounded-full" style={{ background: segmentMeta(s.segment).tone }} />{s.segment}</span>
            <span className="mt-1 block text-[15px] font-semibold tabular-nums">{s.customers.toLocaleString('pt-BR')}</span>
            <span className="block text-[10.5px] text-muted-foreground tabular-nums">{fmtBRL(s.revenue)} · {s.avg_recency_days} d sem comprar</span>
          </button>
        ))}
      </div>
      {sel && <p className="rounded-lg bg-muted/50 px-3 py-2 text-[12px]"><b>{sel.segment}:</b> {segmentMeta(sel.segment).action}</p>}
      <div className="rounded-xl border border-border bg-card p-4">
        <CustomersTable segment={segment} onSegmentChange={setSegment} />
      </div>
      {data.refreshed_at && <p className="text-[11px] text-muted-foreground">Base de clientes atualizada às {new Date(data.refreshed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (recalcula a cada hora).</p>}
    </div>
  );
}
