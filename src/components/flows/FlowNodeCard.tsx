// src/components/flows/FlowNodeCard.tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_CATALOG, type NodeType, type SummaryCtx } from '@/lib/flows/catalog';
import type { NodeStats } from '@/hooks/useFlows';

export interface CardData { type: NodeType; data: Record<string, unknown>; stats?: NodeStats; ctx: SummaryCtx; error?: string; [k: string]: unknown }

function FlowNodeCardImpl({ data, selected }: NodeProps) {
  const d = data as unknown as CardData;
  const meta = NODE_CATALOG[d.type];
  const Icon = meta.icon;
  const handles = meta.handles(d.data);
  const s = d.stats;
  return (
    <div className={`group/node relative w-[240px] overflow-hidden rounded-xl border bg-card/90 backdrop-blur shadow-sm transition-all hover:shadow-lg ${selected ? 'ring-2 ring-foreground/60' : ''} ${d.error ? 'border-red-500' : 'border-border'}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />
      {d.type !== 'trigger' && <Handle type="target" position={Position.Top} className="!size-2.5 !bg-foreground/60" />}
      <div className="relative flex items-center gap-2 px-3 pt-2.5">
        <span className="grid size-8 place-items-center rounded-lg border" style={{ color: meta.tone, borderColor: `${meta.tone}55`, background: `${meta.tone}14` }}><Icon className="size-4" /></span>
        <span className="rounded-full border border-border/60 bg-background/80 px-1.5 py-0 text-[9px] font-medium uppercase tracking-[0.15em] text-foreground/60">{meta.label}</span>
      </div>
      <p className="px-3 pb-2 pt-1 text-[13px] font-medium leading-snug">{meta.summary(d.data, d.ctx)}</p>
      {d.data.use_personal_coupon === true && <p className="px-3 pb-2 -mt-1 text-[11px] text-emerald-600">com cupom pessoal (NOME15)</p>}
      {s && (s.entered > 0 || s.waiting > 0) && (
        <div className="grid grid-cols-4 gap-px border-t border-border/60 bg-border/40 text-center text-[10.5px] tabular-nums">
          <div className="bg-card py-1"><div className="font-semibold">{s.entered}</div><div className="text-muted-foreground">passaram</div></div>
          <div className="bg-card py-1"><div className="font-semibold">{s.waiting}</div><div className="text-muted-foreground">aguardam</div></div>
          <div className="bg-card py-1"><div className="font-semibold">{s.sent || s.would_send}</div><div className="text-muted-foreground">{s.sent ? 'enviados' : 'simulados'}</div></div>
          <div className="bg-card py-1"><div className="font-semibold">{s.sales}</div><div className="text-muted-foreground">vendas</div></div>
        </div>)}
      {d.error && <p className="px-3 py-1.5 text-[11px] text-red-600 border-t border-red-500/30">{d.error}</p>}
      <div className="relative h-3">
        {handles.map((h, i) => (
          <Handle key={h.id} id={h.id} type="source" position={Position.Bottom}
            style={{ left: `${((i + 1) / (handles.length + 1)) * 100}%` }} className="!size-2.5 !bg-foreground/60">
            {h.label && <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground">{h.label}</span>}
          </Handle>))}
      </div>
    </div>
  );
}
export const FlowNodeCard = memo(FlowNodeCardImpl);
