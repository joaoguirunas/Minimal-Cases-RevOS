import { useMemo, useState } from 'react';
import {
  Webhook as WebhookIcon,
  Plus,
  Copy,
  Check,
  Trash2,
  Loader2,
  Pencil,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabaseUrl } from '@/integrations/supabase/client';
import { usePipelines } from '@/hooks/usePipelines';
import {
  useInboundWebhooks,
  useCreateInboundWebhook,
  useUpdateInboundWebhook,
  useDeleteInboundWebhook,
  type CreateMode,
  type InboundWebhook,
  type InboundWebhookFieldMapping,
  type InboundWebhookTriggerConfig,
} from '@/hooks/useInboundWebhooks';
import { useWhatsappChannels } from '@/hooks/useWhatsappChannels';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';

const CRM_FIELDS: { value: string; label: string }[] = [
  { value: 'pessoa.nome', label: 'Nome' },
  { value: 'pessoa.email', label: 'E-mail' },
  { value: 'pessoa.telefone', label: 'Telefone' },
  { value: 'pessoa.whatsapp', label: 'WhatsApp' },
  { value: 'pessoa.cargo', label: 'Cargo' },
  { value: 'empresa.nome', label: 'Empresa (Nome)' },
  { value: 'empresa.website', label: 'Empresa (Site)' },
  { value: 'pessoa.observacoes', label: 'Observações' },
];

export const WEBHOOK_DEFAULT_MAPPING: InboundWebhookFieldMapping[] = [
  { source_key: 'nome', crm_field: 'pessoa.nome', label: 'Nome' },
  { source_key: 'whatsapp', crm_field: 'pessoa.whatsapp', label: 'WhatsApp' },
  { source_key: 'email', crm_field: 'pessoa.email', label: 'E-mail' },
];

const PLACEHOLDER_BY_CRM_FIELD: Record<string, string> = {
  'pessoa.nome': 'João Silva',
  'pessoa.email': 'joao@exemplo.com',
  'pessoa.telefone': '+5511999999999',
  'pessoa.whatsapp': '+5511999999999',
  'pessoa.cargo': 'Diretor Comercial',
  'empresa.nome': 'Empresa Exemplo Ltda',
  'empresa.website': 'https://exemplo.com',
  'pessoa.observacoes': 'Interessado em demonstração',
};

const placeholderFor = (crmField: string): string =>
  PLACEHOLDER_BY_CRM_FIELD[crmField] ?? '<valor>';

const GENERIC_SAMPLE_PAYLOAD: Record<string, string> = {
  nome: 'João Silva',
  email: 'joao@exemplo.com',
  whatsapp: '+5511999999999',
};

export function buildSamplePayload(
  mapping: InboundWebhookFieldMapping[],
): Record<string, string> {
  const valid = mapping.filter(
    (m) => m.source_key.trim() && m.crm_field.trim(),
  );
  if (valid.length === 0) return { ...GENERIC_SAMPLE_PAYLOAD };
  const out: Record<string, string> = {};
  for (const m of valid) {
    out[m.source_key.trim()] = placeholderFor(m.crm_field.trim());
  }
  return out;
}

export function buildSampleCurl({
  url,
  payload,
}: {
  url: string;
  payload: Record<string, string>;
}): string {
  const body = JSON.stringify(payload);
  return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${body}'`;
}

const CREATE_MODE_OPTIONS: {
  value: CreateMode;
  label: string;
  microcopy: string;
}[] = [
  {
    value: 'criar_se_nao_existir',
    label: 'Criar se não existir',
    microcopy:
      'Cria um lead novo apenas quando a pessoa ainda não tem lead neste pipeline.',
  },
  {
    value: 'criar',
    label: 'Sempre criar novo lead',
    microcopy:
      'Sempre cria um lead novo, mesmo que a pessoa já exista (atenção: pode duplicar).',
  },
  {
    value: 'atualizar_etapa',
    label: 'Atualizar etapa (se lead existir)',
    microcopy:
      'Se a pessoa já tem lead, move para a etapa configurada. Se não, ignora o envio.',
  },
  {
    value: 'somente_etapa',
    label: 'Apenas mover etapa',
    microcopy:
      'Move o lead existente para a etapa configurada. Não cria nada novo.',
  },
];

const createModeRequiresStage = (mode: CreateMode): boolean =>
  mode === 'atualizar_etapa' || mode === 'somente_etapa';

const DELAY_OPTIONS = [
  { value: 0, label: 'Imediato' },
  { value: 5, label: '5 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
];

const NONE_VALUE = '__none__';

const buildWebhookUrl = (token: string) =>
  `${supabaseUrl}/functions/v1/webhook-inbound?token=${token}`;

const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
      {title}
    </p>
  </div>
);

// ── URL field with copy ──────────────────────────────────────────────────────
function WebhookUrlField({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = buildWebhookUrl(token);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate text-[11px] font-mono bg-muted border border-border rounded-[4px] px-3 py-1.5">
        {url}
      </code>
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7 flex-shrink-0"
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}

// ── Field mapping editor ─────────────────────────────────────────────────────
function FieldMappingEditor({
  value,
  onChange,
}: {
  value: InboundWebhookFieldMapping[];
  onChange: (next: InboundWebhookFieldMapping[]) => void;
}) {
  const update = (index: number, patch: Partial<InboundWebhookFieldMapping>) => {
    const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...value, { source_key: '', crm_field: '', label: '' }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[12px] text-muted-foreground/70">
          Mapeamento de campos
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={add}
        >
          <Plus className="w-3 h-3 mr-1" />
          Adicionar campo
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="border border-dashed border-border rounded-[4px] px-4 py-6 text-center">
          <p className="text-[12px] text-muted-foreground/60">
            Nenhum campo mapeado. Adicione ao menos um para que os dados sejam
            ingeridos no CRM.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-[4px] overflow-hidden">
          <div className="grid grid-cols-[1fr,auto,1fr,auto] gap-2 px-3 py-2 bg-muted border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Chave no payload
            </span>
            <span />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Campo CRM
            </span>
            <span />
          </div>
          {value.map((row, i) => {
            const matched = CRM_FIELDS.find((f) => f.value === row.crm_field);
            return (
              <div
                key={i}
                className={cn(
                  'grid grid-cols-[1fr,auto,1fr,auto] gap-2 items-center px-3 py-2',
                  i !== value.length - 1 && 'border-b border-border',
                )}
              >
                <Input
                  value={row.source_key}
                  onChange={(e) => update(i, { source_key: e.target.value })}
                  placeholder="ex: email"
                  className="h-[30px] text-[12px] font-mono"
                />
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                <Select
                  value={row.crm_field || undefined}
                  onValueChange={(v) => {
                    const f = CRM_FIELDS.find((x) => x.value === v);
                    update(i, {
                      crm_field: v,
                      label: f?.label ?? row.label,
                    });
                  }}
                >
                  <SelectTrigger className="h-[30px] text-[12px]">
                    <SelectValue placeholder="Selecione o campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-[12px]">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {matched && row.label !== matched.label && (
                  <span className="col-span-4 text-[10px] text-muted-foreground/40 pt-0.5">
                    Rótulo: {row.label || matched.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Editor modal ─────────────────────────────────────────────────────────────
type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; webhook: InboundWebhook };

// ── Payload preview (Story 1.1, 1.2) ─────────────────────────────────────────
function WebhookPayloadPreview({
  mapping,
  token,
}: {
  mapping: InboundWebhookFieldMapping[];
  token: string | null;
}) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const isSaved = !!token;
  const url = isSaved ? buildWebhookUrl(token!) : buildWebhookUrl('{token}');

  const payload = useMemo(() => buildSamplePayload(mapping), [mapping]);
  const jsonText = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const curlText = useMemo(
    () => buildSampleCurl({ url, payload }),
    [url, payload],
  );

  const hasValidMapping = mapping.some(
    (m) => m.source_key.trim() && m.crm_field.trim(),
  );

  const handleCopyJson = () => {
    if (!isSaved) return;
    navigator.clipboard.writeText(jsonText);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  const handleCopyCurl = () => {
    if (!isSaved) return;
    navigator.clipboard.writeText(curlText);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1800);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[12px] text-muted-foreground/70">
          Payload de envio
          {!hasValidMapping && (
            <span className="ml-1.5 text-[10px] text-muted-foreground/40">(exemplo)</span>
          )}
        </Label>
        <div className="flex items-center gap-2">
          {isSaved && (
            <button
              type="button"
              onClick={handleCopyCurl}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {copiedCurl ? '✓ cURL copiado' : 'Copiar como cURL'}
            </button>
          )}
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleCopyJson}
            disabled={!isSaved}
            title={!isSaved ? 'Salve o webhook para copiar' : 'Copiar JSON'}
            aria-label="Copiar JSON"
          >
            {copiedJson ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
      <pre className="bg-muted border border-border rounded-[4px] px-3 py-2 overflow-x-auto max-h-[110px] overflow-y-auto">
        <code className="text-[11px] font-mono whitespace-pre">{jsonText}</code>
      </pre>
    </div>
  );
}

// ── Trigger config panel (Story 4.2) ─────────────────────────────────────────
function WebhookTriggerConfigPanel({
  enabled,
  onEnabledChange,
  waChannelId,
  onWaChannelIdChange,
  waTemplateId,
  onWaTemplateIdChange,
  delayMinutes,
  onDelayMinutesChange,
  hasWhatsappFieldMapped,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  waChannelId: string;
  onWaChannelIdChange: (v: string) => void;
  waTemplateId: string;
  onWaTemplateIdChange: (v: string) => void;
  delayMinutes: number;
  onDelayMinutesChange: (v: number) => void;
  hasWhatsappFieldMapped: boolean;
}) {
  const { data: channels = [] } = useWhatsappChannels();
  const { data: allTemplates = [] } = useWhatsappTemplates();
  const templates = useMemo(
    () =>
      allTemplates.filter(
        (t) => t.status === 'approved' || t.status === 'active' || t.status === 'APPROVED',
      ),
    [allTemplates],
  );

  const selectedTemplate = useMemo(
    () => allTemplates.find((t) => t.id === waTemplateId) ?? null,
    [allTemplates, waTemplateId],
  );

  const bodyPreview = useMemo(() => {
    const raw = selectedTemplate?.json_data?.data ?? '';
    const oneLine = raw.replace(/\s+/g, ' ').trim();
    return oneLine.length > 140 ? `${oneLine.slice(0, 140)}…` : oneLine;
  }, [selectedTemplate]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[12px] text-muted-foreground/70">
            Disparo automático
          </Label>
          <p className="text-[11px] text-muted-foreground/60">
            Enviar WhatsApp template após ingestão (opcional)
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label="Ativar disparo automático"
        />
      </div>

      {enabled && (
        <div className="space-y-3 border border-border rounded-[4px] px-3 py-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/70">Canal</Label>
            <Select value="whatsapp" disabled>
              <SelectTrigger className="h-[34px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp" className="text-[13px]">
                  WhatsApp
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/70">
              Canal WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Select
              value={waChannelId || NONE_VALUE}
              onValueChange={(v) => {
                onWaChannelIdChange(v === NONE_VALUE ? '' : v);
                onWaTemplateIdChange('');
              }}
            >
              <SelectTrigger className="h-[34px] text-[13px]">
                <SelectValue placeholder="Selecione um canal WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE} className="text-[13px]">
                  — selecione —
                </SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.label}
                    {c.is_default ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {channels.length === 0 && (
              <p className="text-[11px] text-amber-500/80">
                Nenhum canal WhatsApp ativo. Configure em Integrações → WhatsApp.
              </p>
            )}
          </div>

          {waChannelId && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground/70">
                Template <span className="text-destructive">*</span>
              </Label>
              <Select
                value={waTemplateId || NONE_VALUE}
                onValueChange={(v) =>
                  onWaTemplateIdChange(v === NONE_VALUE ? '' : v)
                }
              >
                <SelectTrigger className="h-[34px] text-[13px]">
                  <SelectValue placeholder="Selecione um template aprovado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE} className="text-[13px]">
                    — selecione —
                  </SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-[13px]">
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground/60">
                Somente templates aprovados pelo WhatsApp Business.
              </p>
            </div>
          )}

          {selectedTemplate && (
            <div className="border border-border rounded-[4px] px-3 py-2 bg-muted/30 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Preview · {selectedTemplate.nome}
              </p>
              {bodyPreview && (
                <p className="text-[11px] text-muted-foreground/80 font-mono">
                  {bodyPreview}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground/70">
              Aguardar antes de disparar
            </Label>
            <Select
              value={String(delayMinutes)}
              onValueChange={(v) => onDelayMinutesChange(Number(v))}
            >
              <SelectTrigger className="h-[34px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELAY_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={String(opt.value)}
                    className="text-[13px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/60">
              {delayMinutes === 0
                ? 'Disparo imediato ao receber o webhook.'
                : `Disparo agendado para ${delayMinutes} minutos após o webhook.`}
            </p>
          </div>

          {!hasWhatsappFieldMapped && (
            <div
              role="alert"
              className="flex items-start gap-1.5 text-[11px] text-amber-600"
            >
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                Adicione um campo mapeado para WhatsApp acima para que o disparo
                funcione.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WebhookEditor({
  state,
  onClose,
}: {
  state: EditorState;
  onClose: () => void;
}) {
  const isOpen = state.mode !== 'closed';
  const isEdit = state.mode === 'edit';
  const existing = state.mode === 'edit' ? state.webhook : null;

  const { pipelines, stages, isLoading: pipelinesLoading } = usePipelines();
  const create = useCreateInboundWebhook();
  const update = useUpdateInboundWebhook();

  const [name, setName] = useState('');
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<InboundWebhookFieldMapping[]>([]);
  const [createMode, setCreateMode] = useState<CreateMode>('criar_se_nao_existir');
  const [triggerEnabled, setTriggerEnabled] = useState(false);
  const [triggerWaChannelId, setTriggerWaChannelId] = useState('');
  const [triggerWaTemplateId, setTriggerWaTemplateId] = useState('');
  const [triggerDelayMinutes, setTriggerDelayMinutes] = useState(0);

  // Hydrate when opening
  const stateKey = isEdit ? (existing?.id ?? 'edit') : 'create';
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (isOpen && openedFor !== stateKey) {
    setOpenedFor(stateKey);
    setName(existing?.name ?? '');
    setPipelineId(existing?.pipeline_id ?? null);
    setStageId(existing?.stage_id ?? null);
    setMapping(
      isEdit
        ? (existing?.field_mapping ?? [])
        : WEBHOOK_DEFAULT_MAPPING.map((m) => ({ ...m })),
    );
    setCreateMode(existing?.create_mode ?? 'criar_se_nao_existir');
    const tc = existing?.trigger_config ?? null;
    setTriggerEnabled(!!tc?.enabled);
    setTriggerWaChannelId(tc?.wa_channel_id ?? '');
    setTriggerWaTemplateId(tc?.wa_template_id ?? '');
    setTriggerDelayMinutes(tc?.delay_minutes ?? 0);
  }
  if (!isOpen && openedFor !== null) {
    setOpenedFor(null);
  }

  const availableStages = useMemo(() => {
    if (!pipelineId) return [];
    return stages
      .filter((s) => s.pipeline_id === pipelineId)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [pipelineId, stages]);

  const isPending = create.isPending || update.isPending;

  const trimmedName = name.trim();
  const cleanedMapping = mapping
    .map((m) => ({
      source_key: m.source_key.trim(),
      crm_field: m.crm_field.trim(),
      label: m.label.trim(),
    }))
    .filter((m) => m.source_key && m.crm_field);

  const requiresStage = createModeRequiresStage(createMode);
  const stageRequirementMet = requiresStage ? !!stageId : true;
  const triggerRequirementMet =
    !triggerEnabled || (!!triggerWaChannelId && !!triggerWaTemplateId);

  const isValid =
    trimmedName.length > 0 &&
    cleanedMapping.length > 0 &&
    stageRequirementMet &&
    triggerRequirementMet;

  const hasWhatsappFieldMapped = cleanedMapping.some(
    (m) => m.crm_field === 'pessoa.whatsapp',
  );

  const currentMicrocopy =
    CREATE_MODE_OPTIONS.find((o) => o.value === createMode)?.microcopy ?? '';

  const buildTriggerConfig = (): InboundWebhookTriggerConfig | null => {
    if (!triggerEnabled) return null;
    return {
      enabled: true,
      channel: 'whatsapp',
      wa_channel_id: triggerWaChannelId,
      wa_template_id: triggerWaTemplateId,
      wa_variable_map: {},
      delay_minutes: triggerDelayMinutes,
    };
  };

  const handleSave = async () => {
    if (!isValid) return;
    const payload = {
      name: trimmedName,
      pipeline_id: pipelineId,
      stage_id: stageId,
      field_mapping: cleanedMapping,
      create_mode: createMode,
      trigger_config: buildTriggerConfig(),
    };
    try {
      if (isEdit && existing) {
        await update.mutateAsync({ id: existing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-[15px] font-semibold">
            {isEdit ? 'Editar webhook' : 'Novo webhook'}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground/70">
            Configure um endpoint para receber dados de fontes externas e
            transformá-los em leads no CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6">
        <div className="space-y-5 py-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground/70">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Formulário site, Zapier inbound"
              className="h-[34px] text-[13px]"
              autoFocus={!isEdit}
            />
          </div>

          {/* Pipeline / Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">
                Pipeline destino
              </Label>
              <Select
                value={pipelineId ?? NONE_VALUE}
                onValueChange={(v) => {
                  const next = v === NONE_VALUE ? null : v;
                  setPipelineId(next);
                  setStageId(null);
                }}
                disabled={pipelinesLoading}
              >
                <SelectTrigger className="h-[34px] text-[13px]">
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE} className="text-[13px]">
                    Nenhum
                  </SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[13px]">
                      {p.name ?? p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">
                Etapa inicial
                {requiresStage && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              <Select
                value={stageId ?? NONE_VALUE}
                onValueChange={(v) => setStageId(v === NONE_VALUE ? null : v)}
                disabled={!pipelineId || availableStages.length === 0}
              >
                <SelectTrigger className="h-[34px] text-[13px]">
                  <SelectValue
                    placeholder={
                      !pipelineId
                        ? 'Selecione um pipeline antes'
                        : 'Selecione uma etapa'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE} className="text-[13px]">
                    Nenhuma
                  </SelectItem>
                  {availableStages.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[13px]">
                      {s.name ?? s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requiresStage && !stageId && (
                <p className="text-[11px] text-amber-500/80" role="alert">
                  Etapa obrigatória para este comportamento.
                </p>
              )}
            </div>
          </div>

          {/* Comportamento (Story 3.2) */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground/70">
              Comportamento
            </Label>
            <Select
              value={createMode}
              onValueChange={(v) => setCreateMode(v as CreateMode)}
            >
              <SelectTrigger className="h-[34px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATE_MODE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-[13px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/60">
              {currentMicrocopy}
            </p>
          </div>

          {/* Webhook URL preview (edit only) */}
          {isEdit && existing && (
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">
                URL do webhook
              </Label>
              <WebhookUrlField token={existing.token} />
            </div>
          )}

          {/* Field mapping */}
          <FieldMappingEditor value={mapping} onChange={setMapping} />

          {/* Payload de envio (Story 1.1, 1.2) — após mapping para refletir campos configurados */}
          <WebhookPayloadPreview
            mapping={mapping}
            token={existing?.token ?? null}
          />

          {/* Disparo automático (Story 4.2) */}
          <WebhookTriggerConfigPanel
            enabled={triggerEnabled}
            onEnabledChange={setTriggerEnabled}
            waChannelId={triggerWaChannelId}
            onWaChannelIdChange={setTriggerWaChannelId}
            waTemplateId={triggerWaTemplateId}
            onWaTemplateIdChange={setTriggerWaTemplateId}
            delayMinutes={triggerDelayMinutes}
            onDelayMinutesChange={setTriggerDelayMinutes}
            hasWhatsappFieldMapped={hasWhatsappFieldMapped}
          />
        </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isValid || isPending}>
            {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────
function WebhookRow({
  webhook,
  last,
  onEdit,
  onDelete,
}: {
  webhook: InboundWebhook;
  last: boolean;
  onEdit: (w: InboundWebhook) => void;
  onDelete: (w: InboundWebhook) => void;
}) {
  const update = useUpdateInboundWebhook();
  const { pipelines, stages } = usePipelines();

  const pipelineName = useMemo(() => {
    if (!webhook.pipeline_id) return null;
    const p = pipelines.find((x) => x.id === webhook.pipeline_id);
    return p?.name ?? p?.nome ?? null;
  }, [pipelines, webhook.pipeline_id]);

  const stageName = useMemo(() => {
    if (!webhook.stage_id) return null;
    const s = stages.find((x) => x.id === webhook.stage_id);
    return s?.name ?? s?.nome ?? null;
  }, [stages, webhook.stage_id]);

  const handleToggle = (next: boolean) => {
    update.mutate(
      { id: webhook.id, active: next },
      {
        onSuccess: () => {
          // toast omitted for low-friction toggle
        },
      },
    );
  };

  return (
    <div
      className={cn(
        'flex items-start gap-4 px-5 py-3.5',
        !last && 'border-b border-border',
      )}
    >
      <WebhookIcon className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-1" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground truncate">
            {webhook.name}
          </span>
          {!webhook.active && (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground border-border px-1.5 py-0"
            >
              Inativo
            </Badge>
          )}
          {pipelineName && (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground/70 border-border px-1.5 py-0"
            >
              {pipelineName}
              {stageName && ` · ${stageName}`}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[10px] text-muted-foreground/70 border-border px-1.5 py-0"
          >
            {webhook.field_mapping.length}{' '}
            {webhook.field_mapping.length === 1 ? 'campo' : 'campos'}
          </Badge>
        </div>

        <WebhookUrlField token={webhook.token} />
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 mr-2">
          <Switch
            checked={webhook.active}
            onCheckedChange={handleToggle}
            disabled={update.isPending}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
          onClick={() => onEdit(webhook)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
          onClick={() => onDelete(webhook)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Delete dialog ────────────────────────────────────────────────────────────
function DeleteDialog({
  webhook,
  onClose,
}: {
  webhook: InboundWebhook | null;
  onClose: () => void;
}) {
  const del = useDeleteInboundWebhook();

  const handleDelete = async () => {
    if (!webhook) return;
    try {
      await del.mutateAsync(webhook.id);
      onClose();
    } catch {
      // toast handled in hook
    }
  };

  return (
    <AlertDialog open={!!webhook} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[15px]">
            Excluir webhook
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] leading-relaxed">
            Esta ação é irreversível. Integrações externas que enviam dados
            para{' '}
            <span className="font-semibold text-foreground">
              {webhook?.name}
            </span>{' '}
            deixarão de funcionar imediatamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={del.isPending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {del.isPending && (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            )}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
const WebhookInboundConfig = () => {
  const { data: webhooks = [], isLoading } = useInboundWebhooks();
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [toDelete, setToDelete] = useState<InboundWebhook | null>(null);

  const activeWebhooks = webhooks.filter((w) => w.active);
  const inactiveWebhooks = webhooks.filter((w) => !w.active);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Webhook</h2>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5">
            Endpoints públicos para receber dados de fontes externas (formulários,
            Zapier, n8n) e ingerir como leads no CRM.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditor({ mode: 'create' })}
          className="h-8 text-[12px]"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Novo webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="border border-dashed border-border rounded-[4px] px-6 py-12 text-center space-y-3">
          <WebhookIcon className="w-7 h-7 mx-auto text-muted-foreground/30" />
          <div>
            <p className="text-[13px] text-foreground">
              Nenhum webhook configurado
            </p>
            <p className="text-[12px] text-muted-foreground/60 mt-1">
              Crie o primeiro para começar a receber leads de fora do sistema.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditor({ mode: 'create' })}
            className="h-8 text-[12px]"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Criar webhook
          </Button>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-[2px] overflow-hidden">
            <SectionHeader title="WEBHOOKS ATIVOS" />
            {activeWebhooks.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-muted-foreground/50">
                  Nenhum webhook ativo.
                </p>
              </div>
            ) : (
              activeWebhooks.map((w, i) => (
                <WebhookRow
                  key={w.id}
                  webhook={w}
                  last={i === activeWebhooks.length - 1}
                  onEdit={(webhook) => setEditor({ mode: 'edit', webhook })}
                  onDelete={(webhook) => setToDelete(webhook)}
                />
              ))
            )}
          </div>

          {inactiveWebhooks.length > 0 && (
            <div className="border border-border rounded-[2px] overflow-hidden">
              <SectionHeader title="INATIVOS" />
              {inactiveWebhooks.map((w, i) => (
                <WebhookRow
                  key={w.id}
                  webhook={w}
                  last={i === inactiveWebhooks.length - 1}
                  onEdit={(webhook) => setEditor({ mode: 'edit', webhook })}
                  onDelete={(webhook) => setToDelete(webhook)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <WebhookEditor
        state={editor}
        onClose={() => setEditor({ mode: 'closed' })}
      />
      <DeleteDialog
        webhook={toDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
};

export default WebhookInboundConfig;
