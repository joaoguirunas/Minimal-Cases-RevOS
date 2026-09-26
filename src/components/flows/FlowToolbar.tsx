// src/components/flows/FlowToolbar.tsx
import { Loader2 } from 'lucide-react';
import { STATUS_LABEL } from '@/lib/flows/catalog';
export function FlowToolbar({ name, status, saving, onRename, onValidate, onPublish, onStatus, version }: {
  name: string; status: string; saving: boolean; version: number | null; onRename: (n: string) => void;
  onValidate: () => void; onPublish: () => void; onStatus: (s: string) => void;
}) {
  const st = STATUS_LABEL[status] ?? STATUS_LABEL.draft;
  return (
    <div className="flex h-12 items-center gap-3 border-b border-border bg-card px-4">
      <input value={name} onChange={(e) => onRename(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none" />
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
      {version && <span className="text-[11px] text-muted-foreground">v{version}</span>}
      {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      <button onClick={onValidate} className="rounded-md border border-border px-3 py-1.5 text-[12px] hover:bg-muted">Validar</button>
      <button onClick={onPublish} className="rounded-md border border-border px-3 py-1.5 text-[12px] hover:bg-muted">Publicar versão</button>
      {status !== 'simulation' && <button onClick={() => onStatus('simulation')} className="rounded-md border border-amber-500/40 px-3 py-1.5 text-[12px] text-amber-600 hover:bg-amber-500/10">Simular</button>}
      {status !== 'live' && <button onClick={() => onStatus('live')} className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background">Ativar</button>}
      {(status === 'live' || status === 'simulation') && <button onClick={() => onStatus('paused')} className="rounded-md border border-border px-3 py-1.5 text-[12px] hover:bg-muted">Pausar</button>}
    </div>
  );
}
