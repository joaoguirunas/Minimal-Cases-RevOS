// src/components/flows/NodeInspector.tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NODE_CATALOG, type NodeType } from '@/lib/flows/catalog';
import type { Catalog } from '@/hooks/useFlows';
import { WhatsAppPreview, EmailPreview } from './MessagePreview';

type Variant = { key: string; pct: number };
export function NodeInspector({ type, data, onChange, onDelete, catalog }: {
  type: NodeType; data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; onDelete: () => void; catalog?: Catalog;
}) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const meta = NODE_CATALOG[type];
  const wa = catalog?.wa_templates.find((t) => String(t.id_template) === String(data.template_id));
  return (
    <div className="w-80 shrink-0 border-l border-border bg-card p-4 space-y-4 overflow-y-auto">
      <p className="text-[13px] font-semibold">{meta.label}</p>
      {type === 'wait' && (<>
        <div className="flex items-center justify-between"><Label className="text-[12px]">Até o horário comercial</Label>
          <Switch checked={data.until === 'business_hours'} onCheckedChange={(c) => onChange(c ? { until: 'business_hours' } : { amount: 1, unit: 'hours' })} /></div>
        {data.until !== 'business_hours' && (<div className="flex gap-2">
          <Input type="number" min={1} value={Number(data.amount ?? 1)} onChange={(e) => set('amount', Number(e.target.value))} className="h-8 w-24" />
          <Select value={String(data.unit ?? 'hours')} onValueChange={(v) => set('unit', v)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="minutes">minutos</SelectItem><SelectItem value="hours">horas</SelectItem><SelectItem value="days">dias</SelectItem></SelectContent>
          </Select></div>)}
      </>)}
      {type === 'condition' && (<>
        <Select value={String(data.check ?? '')} onValueChange={(v) => set('check', v)}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="clicked_since_start">Clicou em algum link desde que entrou</SelectItem>
            <SelectItem value="clicked_channel">Clicou num link de um canal</SelectItem>
            <SelectItem value="purchased">Comprou</SelectItem>
            <SelectItem value="has_whatsapp">Tem WhatsApp</SelectItem>
            <SelectItem value="has_email">Tem e-mail (inscrito)</SelectItem>
            <SelectItem value="has_tag">Tem a tag</SelectItem>
          </SelectContent>
        </Select>
        {data.check === 'clicked_channel' && (
          <Select value={String(data.channel ?? 'whatsapp')} onValueChange={(v) => set('channel', v)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">E-mail</SelectItem></SelectContent>
          </Select>)}
        {data.check === 'has_tag' && <Input value={String(data.tag ?? '')} onChange={(e) => set('tag', e.target.value)} placeholder="tag" className="h-8" />}
      </>)}
      {type === 'split' && (<div className="space-y-2">
        {((data.variants as Variant[]) ?? []).map((v, i, arr) => (
          <div key={v.key} className="flex items-center gap-2">
            <span className="w-6 text-[12px] font-semibold uppercase">{v.key}</span>
            <Input type="number" min={0} max={100} value={v.pct} className="h-8 w-20"
              onChange={(e) => set('variants', arr.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))} /><span className="text-[12px]">%</span>
          </div>))}
        <button className="text-[12px] text-primary hover:underline" onClick={() => {
          const arr = (data.variants as Variant[]) ?? []; set('variants', [...arr, { key: String.fromCharCode(97 + arr.length), pct: 0 }]);
        }}>+ variante</button>
      </div>)}
      {type === 'send_whatsapp' && (<>
        <Select value={String(data.template_id ?? '')} onValueChange={(v) => set('template_id', v)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Template aprovado" /></SelectTrigger>
          <SelectContent>{(catalog?.wa_templates ?? []).filter((t) => String(t.status).toLowerCase() === 'approved')
            .map((t) => <SelectItem key={t.id_template} value={String(t.id_template)}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        {wa && <WhatsAppPreview body={wa.body} coupon={data.use_personal_coupon === true} />}
      </>)}
      {type === 'send_email' && (<>
        <Select value={String(data.email_template_id ?? '')} onValueChange={(v) => set('email_template_id', v)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Template de e-mail" /></SelectTrigger>
          <SelectContent>{(catalog?.email_templates ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        <EmailPreview templateId={String(data.email_template_id ?? '')} />
      </>)}
      {(type === 'send_whatsapp' || type === 'send_email') && (
        <div className="flex items-center justify-between"><Label className="text-[12px]">Usar cupom pessoal (NOME15)</Label>
          <Switch checked={data.use_personal_coupon === true} onCheckedChange={(c) => set('use_personal_coupon', c)} /></div>)}
      {type === 'move_stage' && (
        <Select value={String(data.stage_id ?? '')} onValueChange={(v) => set('stage_id', v)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>{(catalog?.stages ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.pipeline} · {s.name}</SelectItem>)}</SelectContent>
        </Select>)}
      {type === 'add_tag' && <Input value={String(data.tag ?? '')} onChange={(e) => set('tag', e.target.value)} placeholder="nome da tag" className="h-8" />}
      {type !== 'trigger' && <button onClick={onDelete} className="text-[12px] text-red-600 hover:underline">Remover nó</button>}
    </div>
  );
}
