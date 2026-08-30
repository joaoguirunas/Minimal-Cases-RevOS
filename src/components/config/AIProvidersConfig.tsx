import { useState } from 'react';
import { Key, Plus, Pencil, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  useAIProviders,
  useCreateAIProvider,
  useUpdateAIProvider,
  useDeleteAIProvider,
  type AIProvider,
  type AIProviderInput,
} from '@/hooks/useAgentesIA';

const PROVIDER_OPTIONS = [
  { value: 'openai',    label: 'OpenAI',          hint: 'gpt-5.4, gpt-5.4-mini, o3-mini' },
  { value: 'anthropic', label: 'Anthropic',        hint: 'claude-opus-4-6, claude-sonnet-4-6' },
  { value: 'groq',      label: 'Groq',             hint: 'llama-3.3-70b, mixtral-8x7b' },
  { value: 'gemini',    label: 'Google Gemini',    hint: 'gemini-2.5-flash-native-audio-preview-12-2025, gemini-2.0-flash' },
];

const PROVIDER_COLORS: Record<string, string> = {
  openai:    'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  anthropic: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400',
  groq:      'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400',
  gemini:    'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
};

const ConfiguredBadge = () => (
  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-0.5">
    <CheckCircle2 className="h-2.5 w-2.5" />
    configurado
  </span>
);

// ── Provider form modal ───────────────────────────────────────────────────────

interface ProviderFormModalProps {
  open: boolean;
  onClose: () => void;
  existing?: AIProvider | null;
}

const ProviderFormModal = ({ open, onClose, existing }: ProviderFormModalProps) => {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    provider: existing?.provider ?? 'openai',
    label: existing?.label ?? '',
    api_key: '',
    is_default: existing?.is_default ?? false,
    active: existing?.active ?? true,
  });
  const [apiKeyChanged, setApiKeyChanged] = useState(!isEdit);

  const createMutation = useCreateAIProvider();
  const updateMutation = useUpdateAIProvider();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    const base: Partial<AIProviderInput> = {
      provider: form.provider,
      label: form.label || PROVIDER_OPTIONS.find(p => p.value === form.provider)?.label || form.provider,
      is_default: form.is_default,
      active: form.active,
    };

    if (apiKeyChanged) {
      base.api_key = form.api_key;
    }

    try {
      if (isEdit && existing) {
        await updateMutation.mutateAsync({ id: existing.id, ...base });
      } else {
        await createMutation.mutateAsync(base as AIProviderInput);
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {isEdit ? 'Editar provedor' : 'Adicionar provedor de IA'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Provedor</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => setForm(f => ({ ...f, provider: v }))}
              disabled={isEdit}
            >
              <SelectTrigger className="h-[30px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div>
                      <span>{p.label}</span>
                      <span className="text-muted-foreground text-[10px] ml-2">{p.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Label
              <span className="ml-1 text-muted-foreground/50 font-normal">— nome interno para identificar</span>
            </Label>
            <Input
              value={form.label}
              onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder={PROVIDER_OPTIONS.find(p => p.value === form.provider)?.label ?? 'Ex: OpenAI Principal'}
              className="h-[30px] text-sm"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              API Key
              {isEdit && (
                <button
                  className="ml-2 text-[10px] text-primary hover:underline font-normal"
                  onClick={() => setApiKeyChanged(v => !v)}
                >
                  {apiKeyChanged ? 'cancelar alteração' : 'alterar chave'}
                </button>
              )}
            </Label>
            <Input
              type="password"
              value={form.api_key}
              onChange={(e) => { setForm(f => ({ ...f, api_key: e.target.value })); setApiKeyChanged(true); }}
              placeholder={isEdit && !apiKeyChanged ? 'Chave atual mantida' : 'sk-...'}
              disabled={isEdit && !apiKeyChanged}
              className="h-[30px] text-sm font-mono"
            />
          </div>

          {/* Default + Active */}
          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_default}
                onCheckedChange={(v) => setForm(f => ({ ...f, is_default: v }))}
              />
              <span className="text-xs text-muted-foreground">Padrão para este provedor</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))}
              />
              <span className="text-xs text-muted-foreground">Ativo</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending || (!apiKeyChanged && !isEdit)}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {isEdit ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const AIProvidersConfig = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const { data: providers = [], isLoading } = useAIProviders();
  const deleteMutation = useDeleteAIProvider();

  const openCreate = () => { setEditingProvider(null); setShowModal(true); };
  const openEdit = (p: AIProvider) => { setEditingProvider(p); setShowModal(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            Provedores de IA
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie as chaves de API dos modelos de linguagem usados pelos agentes.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-[30px] gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {/* Provider list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-[4px]">
          <Key className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">Nenhum provedor configurado</p>
          <p className="text-xs text-muted-foreground/60 mb-4 max-w-sm">
            Adicione uma chave de API para OpenAI, Anthropic, Groq ou Google Gemini para ativar os agentes de IA.
          </p>
          <Button size="sm" variant="outline" onClick={openCreate} className="h-[30px] gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Adicionar primeiro provedor
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-[4px] overflow-hidden divide-y divide-border/30">
          {providers.map((provider) => {
            const provColor = PROVIDER_COLORS[provider.provider] ?? PROVIDER_COLORS.openai;
            const provLabel = PROVIDER_OPTIONS.find(p => p.value === provider.provider)?.label ?? provider.provider;
            return (
              <div
                key={provider.id}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 bg-card',
                  !provider.active && 'opacity-50'
                )}
              >
                {/* Provider badge */}
                <div className="shrink-0">
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-1 rounded border',
                    provColor
                  )}>
                    {provLabel}
                  </span>
                </div>

                {/* Label + key */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate">{provider.label}</p>
                    {provider.is_default && (
                      <div className="flex items-center gap-0.5 text-[9px] text-green-600 dark:text-green-400 shrink-0">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        <span className="font-medium">padrão</span>
                      </div>
                    )}
                    {!provider.active && (
                      <span className="text-[9px] text-muted-foreground/60 border border-border rounded px-1 shrink-0">
                        inativo
                      </span>
                    )}
                  </div>
                  <ConfiguredBadge />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(provider)}
                    className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-foreground"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(provider.id)}
                    disabled={deleteMutation.isPending}
                    className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-destructive"
                    title="Remover"
                  >
                    {deleteMutation.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-[4px] border border-border bg-muted px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Como funciona</p>
        <ul className="space-y-1 list-disc list-inside leading-relaxed">
          <li>Cada agente pode usar uma chave específica via campo "Chave de API" nas configurações do agente</li>
          <li>Se nenhuma chave for selecionada, o agente usa a chave <strong>padrão</strong> do provedor configurado</li>
          <li>As chaves são armazenadas de forma segura no banco de dados (acesso restrito a gestores)</li>
        </ul>
      </div>

<ProviderFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingProvider(null); }}
        existing={editingProvider}
      />
    </div>
  );
};

export default AIProvidersConfig;
