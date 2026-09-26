// src/pages/Fluxos.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useFlows, flowApi, useFlowInvalidate } from '@/hooks/useFlows';
import { STATUS_LABEL, TRIGGER_LABEL } from '@/lib/flows/catalog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function Fluxos() {
  const nav = useNavigate();
  const { data, isLoading } = useFlows();
  const invalidate = useFlowInvalidate();
  const [name, setName] = useState(''); const [trigger, setTrigger] = useState('cart_abandoned');
  const create = async () => {
    try { const r = await flowApi<{ id: string }>({ action: 'create', name: name || 'Novo fluxo', trigger_type: trigger, trigger_config: {} }); invalidate(); nav(`/fluxos/${r.id}`); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[20px] font-semibold">Fluxos</h1><p className="text-[13px] text-muted-foreground">Toques automáticos de WhatsApp e e-mail, montados em nós.</p></div>
        <div className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do fluxo" className="h-9 w-56" />
          <Select value={trigger} onValueChange={setTrigger}><SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TRIGGER_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          <button onClick={create} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] text-background"><Plus className="size-4" />Criar</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-border text-muted-foreground text-left">
            <th className="px-4 py-2 font-medium">Fluxo</th><th className="px-4 py-2 font-medium">Gatilho</th><th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium">Pessoas ativas</th><th className="px-4 py-2 text-right font-medium">Enviados 7d</th><th className="px-4 py-2 text-right font-medium">Vendas 7d</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6"><div className="h-6 rounded bg-muted/50 animate-pulse" /></td></tr>}
            {(data ?? []).map((f) => { const st = STATUS_LABEL[f.status] ?? STATUS_LABEL.draft; return (
              <tr key={f.id} onClick={() => nav(`/fluxos/${f.id}`)} className="cursor-pointer border-b border-border/50 hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{f.name}</td><td className="px-4 py-2.5 text-muted-foreground">{TRIGGER_LABEL[f.trigger_type] ?? f.trigger_type}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{f.active_runs}</td><td className="px-4 py-2.5 text-right tabular-nums">{f.sent_7d}</td><td className="px-4 py-2.5 text-right tabular-nums">{f.sales_7d}</td>
              </tr>); })}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum fluxo ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
