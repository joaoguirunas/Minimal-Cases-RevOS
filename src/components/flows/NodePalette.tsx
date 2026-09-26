// src/components/flows/NodePalette.tsx
import { NODE_CATALOG, type NodeType } from '@/lib/flows/catalog';
const ITEMS: NodeType[] = ['wait', 'condition', 'split', 'send_whatsapp', 'send_email', 'move_stage', 'add_tag', 'exit'];
export function NodePalette() {
  return (
    <div className="w-52 shrink-0 border-r border-border bg-card p-3 space-y-1.5 overflow-y-auto">
      <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Arraste para o fluxo</p>
      {ITEMS.map((t) => { const m = NODE_CATALOG[t]; const Icon = m.icon; return (
        <div key={t} draggable onDragStart={(e) => { e.dataTransfer.setData('application/flow-node', t); e.dataTransfer.effectAllowed = 'move'; }}
          className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-[13px] hover:border-foreground/30 active:cursor-grabbing">
          <span className="grid size-6 place-items-center rounded-md text-white" style={{ background: m.tone }}><Icon className="size-3.5" /></span>{m.label}
        </div>); })}
    </div>
  );
}
