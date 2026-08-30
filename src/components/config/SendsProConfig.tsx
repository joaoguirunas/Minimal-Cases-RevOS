import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Edit, Trash2, Save, X, Link as LinkIcon, Zap, Info,
} from 'lucide-react';
import {
  useSendWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
} from '@/hooks/useSendWebhooks';
import { SendWebhook } from '@/types/sends';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FormData = { name: string; webhook_url: string; active: boolean };

const EMPTY_FORM: FormData = { name: '', webhook_url: '', active: true };

export default function SendsProConfig() {
  const { data: webhooks, isLoading } = useSendWebhooks();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState<FormData>(EMPTY_FORM);

  const cancel = () => { setEditingId(null); setShowCreate(false); setForm(EMPTY_FORM); };

  const startCreate = () => { setShowCreate(true); setEditingId(null); setForm(EMPTY_FORM); };
  const startEdit = (wh: SendWebhook) => {
    setEditingId(wh.id);
    setShowCreate(false);
    setForm({ name: wh.name, webhook_url: wh.webhook_url, active: wh.active });
  };

  const validate = () => {
    if (!form.name.trim()) { toast.error('Informe um nome'); return false; }
    if (!form.webhook_url.trim()) { toast.error('Informe a URL do webhook'); return false; }
    try { new URL(form.webhook_url); } catch { toast.error('URL inválida'); return false; }
    return true;
  };

  const handleCreate = () => {
    if (!validate()) return;
    createWebhook.mutate(
      { name: form.name, webhook_url: form.webhook_url, active: form.active },
      { onSuccess: cancel }
    );
  };

  const handleUpdate = (id: string) => {
    if (!validate()) return;
    updateWebhook.mutate(
      { id, name: form.name, webhook_url: form.webhook_url, active: form.active },
      { onSuccess: cancel }
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir este webhook?')) deleteWebhook.mutate(id);
  };

  const InlineForm = ({ onSave, pending }: { onSave: () => void; pending: boolean }) => (
    <div className="p-5 space-y-4 border-t border-border bg-muted">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[12px]">Nome</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: N8N Campanha WhatsApp"
            className="h-[30px] text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">URL do Webhook</Label>
          <Input
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://n8n.yourserver.com/webhook/..."
            className="h-[30px] text-[13px]"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.active}
            onCheckedChange={(v) => setForm({ ...form, active: v })}
            id="sw-active"
          />
          <Label htmlFor="sw-active" className="text-[13px] font-normal cursor-pointer">Ativo</Label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={pending} className="h-[30px] text-[13px] gap-1.5">
            <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button size="sm" variant="outline" onClick={cancel} className="h-[30px] text-[13px]">
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-[15px] font-semibold text-foreground">Campanhas (SENDS PRO™)</h1>
        </div>
        <p className="text-[13px] text-muted-foreground/70">
          Configure o webhook global do N8N que recebe os dados de cada contato durante os disparos.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-[4px] border border-blue-200/40 bg-blue-500/5">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-foreground">Como funciona</p>
          <p className="text-[12px] text-muted-foreground/70">
            Ao iniciar um disparo, o sistema envia um POST para este webhook com os dados completos
            do contato e do lead. O N8N recebe e cuida do envio (WhatsApp, Email, SMS, etc).
          </p>
        </div>
      </div>

      {/* Webhook list */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-muted border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-orange-500" strokeWidth={1.5} />
            <span className="text-[13px] font-medium text-foreground">Webhooks configurados</span>
          </div>
          {!showCreate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={startCreate}
              className="h-[30px] text-[12px] gap-1.5 text-muted-foreground/60 hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              Adicionar
            </Button>
          )}
        </div>

        {/* Create form */}
        {showCreate && <InlineForm onSave={handleCreate} pending={createWebhook.isPending} />}

        {/* List */}
        {isLoading ? (
          <div className="p-5 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-[4px]" />
            ))}
          </div>
        ) : webhooks && webhooks.length > 0 ? (
          <div className="divide-y divide-border/30">
            {webhooks.map((wh) =>
              editingId === wh.id ? (
                <InlineForm key={wh.id} onSave={() => handleUpdate(wh.id)} pending={updateWebhook.isPending} />
              ) : (
                <div key={wh.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-[30px] h-[30px] bg-muted rounded flex items-center justify-center shrink-0">
                      <LinkIcon className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-normal text-foreground">{wh.name}</span>
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none',
                          wh.active
                            ? 'text-emerald-600 bg-emerald-500/8 border-emerald-200/30'
                            : 'text-muted-foreground/50 bg-muted border-border'
                        )}>
                          {wh.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground/50 truncate mt-0.5">
                        {wh.webhook_url}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => startEdit(wh)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground"
                    >
                      <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => handleDelete(wh.id)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        ) : !showCreate ? (
          <div className="px-5 py-8 text-center">
            <Zap className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
            <p className="text-[13px] text-muted-foreground/50 mb-3">Nenhum webhook configurado</p>
            <Button size="sm" variant="outline" onClick={startCreate} className="gap-1.5 text-[13px]">
              <Plus className="w-3.5 h-3.5" />
              Configurar Webhook
            </Button>
          </div>
        ) : null}
      </div>

      {/* Payload reference */}
      <div className="border border-border rounded-[4px] p-5 space-y-3">
        <p className="text-[12px] font-medium text-muted-foreground/70">Payload enviado ao N8N (por contato)</p>
        <div className="bg-muted border border-border rounded-[4px] p-3 font-mono text-[11px] space-y-1 text-muted-foreground">
          <div><span className="text-blue-400/80">send_id</span><span className="text-muted-foreground/50"> · </span>UUID da campanha</div>
          <div><span className="text-blue-400/80">send_name</span><span className="text-muted-foreground/50"> · </span>Nome da campanha</div>
          <div><span className="text-blue-400/80">channel</span><span className="text-muted-foreground/50"> · </span>whatsapp · email · sms · phone</div>
          <div><span className="text-blue-400/80">contact</span><span className="text-muted-foreground/50"> · </span>{'{ name, whatsapp, email, qualification, … }'}</div>
          <div><span className="text-blue-400/80">scores</span><span className="text-muted-foreground/50"> · </span>{'{ framing, investment, objective }'}</div>
          <div><span className="text-blue-400/80">utm</span><span className="text-muted-foreground/50"> · </span>{'{ utm_source, utm_medium, utm_campaign, utm_content, utm_term }'}</div>
          <div><span className="text-blue-400/80">responsible_name</span><span className="text-muted-foreground/50"> · </span>Nome do responsável pelo lead</div>
          <div><span className="text-blue-400/80">wa_channel_name</span><span className="text-muted-foreground/50"> · </span>Nome do número WA (só WhatsApp)</div>
          <div><span className="text-blue-400/80">timestamp</span><span className="text-muted-foreground/50"> · </span>ISO 8601</div>
        </div>
      </div>
    </div>
  );
}
