import { useState } from 'react';
import { Smartphone, Plus, Pencil, Trash2, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  useWhatsappChannels,
  useCreateWhatsappChannel,
  useUpdateWhatsappChannel,
  useDeleteWhatsappChannel,
  type WhatsappChannel,
} from '@/hooks/useAgentesIA';

// ── Token masked display (list view) ──────────────────────────────────────────

/** Returns e.g. "EAAxxxxx••••••••" — first 8 chars visible */
const tokenPreview = (token: string | null | undefined): string => {
  if (!token) return '';
  return `${token.slice(0, 8)}${'•'.repeat(8)}`;
};

const MaskedToken = ({ token }: { token: string | null | undefined }) => {
  const [show, setShow] = useState(false);
  if (!token) return null;
  const masked = `${token.slice(0, 8)}${'•'.repeat(Math.min(token.length - 8, 20))}`;

  return (
    <div className="flex items-center gap-1.5">
      <code className="text-xs font-mono text-muted-foreground">
        {show ? token : masked}
      </code>
      <button
        onClick={() => setShow(v => !v)}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        title={show ? 'Ocultar' : 'Mostrar'}
      >
        {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
};

// ── Secret field with password toggle ─────────────────────────────────────────

const SecretInput = ({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('h-[30px] text-sm font-mono pr-8', className)}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={cn(
    'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
    ok
      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
      : 'bg-muted text-muted-foreground/60'
  )}>
    {ok
      ? <ShieldCheck className="h-2.5 w-2.5" />
      : <ShieldOff className="h-2.5 w-2.5" />}
    {label}
  </span>
);

// ── Channel form modal ─────────────────────────────────────────────────────────

interface ChannelFormModalProps {
  open: boolean;
  onClose: () => void;
  existing?: WhatsappChannel | null;
}

const ChannelFormModal = ({ open, onClose, existing }: ChannelFormModalProps) => {
  const isEdit = !!existing;

  const [form, setForm] = useState({
    label: existing?.label ?? '',
    phone_number_id: existing?.phone_number_id ?? '',
    waba_id: existing?.waba_id ?? '',
    access_token: '',   // always empty — user types to replace
    app_secret: '',     // always empty — user types to replace
    is_default: existing?.is_default ?? false,
    active: existing?.active ?? true,
  });

  // Lets the user explicitly clear the app_secret
  const [clearSecret, setClearSecret] = useState(false);

  const createMutation = useCreateWhatsappChannel();
  const updateMutation = useUpdateWhatsappChannel();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const hasExistingToken  = isEdit;
  const hasExistingSecret = isEdit && !!existing?.app_secret && !clearSecret;

  const handleSubmit = async () => {
    const payload: Partial<WhatsappChannel> = {
      label:          form.label.trim(),
      phone_number_id: form.phone_number_id.trim(),
      waba_id:        form.waba_id.trim() || null,
      is_default:     form.is_default,
      active:         form.active,
    };

    // Only update token if user typed something new
    if (form.access_token.trim()) {
      payload.access_token = form.access_token.trim();
    }

    // App secret: save if typed, clear if user clicked "Remover"
    if (form.app_secret.trim()) {
      payload.app_secret = form.app_secret.trim();
    } else if (clearSecret) {
      payload.app_secret = null;
    }

    try {
      if (isEdit && existing) {
        await updateMutation.mutateAsync({ id: existing.id, ...payload });
      } else {
        await createMutation.mutateAsync(
          payload as Omit<WhatsappChannel, 'id' | 'created_at' | 'updated_at'>
        );
      }
      onClose();
    } catch {
      // Errors handled by mutation toast
    }
  };

  const canSave = !isPending && !!form.label.trim() && !!form.phone_number_id.trim()
    && (isEdit || !!form.access_token.trim());

  return (
    <Dialog open={open} onOpenChange={() => !isPending && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {isEdit ? 'Editar canal WhatsApp' : 'Novo canal WhatsApp'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* Nome + Ativo */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome do canal</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Número Principal"
                className="h-[30px] text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Ativo</span>
            </div>
          </div>

          {/* Phone Number ID */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Phone Number ID
              <span className="ml-1 text-muted-foreground/40 font-normal">Meta Business Manager</span>
            </Label>
            <Input
              value={form.phone_number_id}
              onChange={(e) => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
              placeholder="123456789012345"
              className="h-[30px] text-sm font-mono"
            />
          </div>

          {/* WABA ID */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              WABA ID
              <span className="ml-1 text-muted-foreground/40 font-normal">WhatsApp Business Account ID</span>
            </Label>
            <Input
              value={form.waba_id}
              onChange={(e) => setForm(f => ({ ...f, waba_id: e.target.value }))}
              placeholder="123456789012345"
              className="h-[30px] text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground/40">
              Encontrado no Meta Business Manager. Necessário para gerenciamento de templates.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Access Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Access Token</Label>
              {isEdit && (
                <StatusBadge ok={!form.access_token} label={form.access_token ? 'Substituindo...' : 'Token salvo'} />
              )}
            </div>
            <SecretInput
              value={form.access_token}
              onChange={(v) => setForm(f => ({ ...f, access_token: v }))}
              placeholder={isEdit ? 'Deixe vazio para manter o atual' : 'EAAxxxxxxx...'}
            />
            {/* Preview do token atual salvo */}
            {isEdit && existing?.access_token && !form.access_token && (
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                Atual: <span className="text-foreground/70">{tokenPreview(existing.access_token)}</span>
              </p>
            )}
          </div>

          {/* App Secret */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                App Secret
                <span className="ml-1 text-muted-foreground/40 font-normal">opcional</span>
              </Label>
              <div className="flex items-center gap-2">
                {isEdit && (
                  <StatusBadge
                    ok={hasExistingSecret}
                    label={hasExistingSecret ? 'Configurado' : 'Não configurado'}
                  />
                )}
                {isEdit && existing?.app_secret && !clearSecret && !form.app_secret && (
                  <button
                    className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                    onClick={() => setClearSecret(true)}
                  >
                    Remover
                  </button>
                )}
                {clearSecret && (
                  <button
                    className="text-[10px] text-primary hover:underline transition-colors"
                    onClick={() => setClearSecret(false)}
                  >
                    Cancelar remoção
                  </button>
                )}
              </div>
            </div>
            <SecretInput
              value={form.app_secret}
              onChange={(v) => { setForm(f => ({ ...f, app_secret: v })); setClearSecret(false); }}
              placeholder={
                clearSecret
                  ? 'Secret será removido ao salvar'
                  : isEdit && existing?.app_secret
                    ? 'Deixe vazio para manter o atual'
                    : 'Cole o App Secret do Meta'
              }
              className={clearSecret ? 'opacity-40 pointer-events-none' : ''}
            />
            {/* Preview do secret atual salvo */}
            {isEdit && existing?.app_secret && !clearSecret && !form.app_secret && (
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                Atual: <span className="text-foreground/70">{tokenPreview(existing.app_secret)}</span>
              </p>
            )}
            {!isEdit && !form.app_secret && (
              <p className="text-[10px] text-muted-foreground/40">
                Valida a assinatura HMAC das mensagens recebidas da Meta.
              </p>
            )}
          </div>

          {/* Canal padrão */}
          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={form.is_default}
              onCheckedChange={(v) => setForm(f => ({ ...f, is_default: v }))}
            />
            <div>
              <span className="text-xs text-muted-foreground">Canal padrão</span>
              <p className="text-[10px] text-muted-foreground/40 leading-tight">
                Usado para envio de mensagens quando nenhum canal específico é selecionado.
              </p>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSave}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {isEdit ? 'Salvar' : 'Adicionar canal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const WhatsappChannelsConfig = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<WhatsappChannel | null>(null);
  const { data: channels = [], isLoading } = useWhatsappChannels();
  const deleteMutation = useDeleteWhatsappChannel();
  const updateMutation = useUpdateWhatsappChannel();

  const openCreate = () => { setEditingChannel(null); setShowModal(true); };
  const openEdit   = (c: WhatsappChannel) => { setEditingChannel(c); setShowModal(true); };

  const toggleActive = (channel: WhatsappChannel) => {
    updateMutation.mutate({ id: channel.id, active: !channel.active });
  };

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-3.5 w-3.5 text-white/40" />
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Canais Business</span>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          className="h-7 gap-1.5 text-[11px] bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
          variant="ghost"
        >
          <Plus className="h-3 w-3" />
          Adicionar canal
        </Button>
      </div>

      {/* Channel list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-white/30">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-xs">Carregando...</span>
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <Smartphone className="h-5 w-5 text-white/20" />
          </div>
          <p className="text-sm font-medium text-white/60 mb-1">Nenhum canal configurado</p>
          <p className="text-xs text-white/30 mb-4 max-w-xs leading-relaxed">
            Adicione um número WhatsApp Business com Phone Number ID e Access Token para habilitar disparos e templates.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={openCreate}
            className="h-7 gap-1.5 text-[11px] border-white/10 text-white/60 hover:text-white hover:border-white/20"
          >
            <Plus className="h-3 w-3" />
            Adicionar primeiro canal
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={cn(
                'rounded-xl border border-white/10 bg-white/5 p-4 transition-opacity',
                !channel.active && 'opacity-50'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="h-4 w-4 text-[#25D366]" />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{channel.label}</span>
                    {channel.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FF4400]/15 text-[#FF4400] border border-[#FF4400]/20">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        padrão
                      </span>
                    )}
                    <button
                      onClick={() => toggleActive(channel)}
                      disabled={updateMutation.isPending}
                      title={channel.active ? 'Clique para pausar' : 'Clique para ativar'}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors cursor-pointer',
                        channel.active
                          ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400'
                          : 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-green-500/20 hover:border-green-500/30 hover:text-green-400'
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', channel.active ? 'bg-green-400' : 'bg-red-400')} />
                      {channel.active ? 'Ativo' : 'Pausado'}
                    </button>
                  </div>

                  {/* IDs row */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <code className="text-[10px] font-mono text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                      ID {channel.phone_number_id}
                    </code>
                    {channel.waba_id ? (
                      <code className="text-[10px] font-mono text-white/30 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                        WABA {channel.waba_id}
                      </code>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Sem WABA ID
                      </span>
                    )}
                  </div>

                  {/* Token preview */}
                  <div className="mt-1.5">
                    <MaskedToken token={channel.access_token} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => openEdit(channel)}
                    className="h-7 w-7 p-0 text-white/30 hover:text-white hover:bg-white/10"
                    title="Editar canal"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => deleteMutation.mutate(channel.id)}
                    disabled={deleteMutation.isPending}
                    className="h-7 w-7 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                    title="Remover canal"
                  >
                    {deleteMutation.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ChannelFormModal
        key={editingChannel?.id ?? 'new'}
        open={showModal}
        onClose={() => { setShowModal(false); setEditingChannel(null); }}
        existing={editingChannel}
      />
    </div>
  );
};

export default WhatsappChannelsConfig;
