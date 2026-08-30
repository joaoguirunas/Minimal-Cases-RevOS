import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CALLBACK_CONFIG_DEFAULTS,
  useAgentCallbackConfigs,
  useUpsertAgentCallbackConfig,
  type AgentCallbackConfig,
  type CallbackMode,
  type CallbackTemplate,
} from '@/hooks/useAgentCallbackConfig';
import { usePassosAgente } from '@/hooks/useAgentesIAReal';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';

// RETORNO-04 — conteúdo do SectionCard "Agendar Retorno" da aba Configurações.
// O SectionCard vive em ConfiguracaoTab.tsx (padrão visual de lá é reusado aqui:
// Label text-xs, inputs h-[30px], helper text-[10px], chips rounded-[4px]).

const DEFAULT_SCOPE = '__default__';
const NO_TEMPLATE = '__none__';

/** Janela de sessão do WhatsApp (ADR-RETORNO-01 D6): acima disso só template aprovado. */
const WHATSAPP_WINDOW_HOURS = 23;

interface CallbackConfigSectionProps {
  agentId: string;
  usaEtapas: boolean;
}

type DraftState = {
  enabled: boolean;
  default_mode: CallbackMode;
  allow_agent_choose_mode: boolean;
  allow_free_text: boolean;
  templates: CallbackTemplate[];
  free_prompt: string;
  whatsapp_template_fallback: string;
  min_delay_minutes: number;
  max_delay_hours: number;
  cancel_on_resume: boolean;
};

const toDraft = (row: AgentCallbackConfig | null): DraftState => ({
  enabled: row?.enabled ?? CALLBACK_CONFIG_DEFAULTS.enabled,
  default_mode: row?.default_mode ?? CALLBACK_CONFIG_DEFAULTS.default_mode,
  allow_agent_choose_mode: row?.allow_agent_choose_mode ?? CALLBACK_CONFIG_DEFAULTS.allow_agent_choose_mode,
  allow_free_text: row?.allow_free_text ?? CALLBACK_CONFIG_DEFAULTS.allow_free_text,
  templates: row?.templates ?? [],
  free_prompt: row?.free_prompt ?? '',
  whatsapp_template_fallback: row?.whatsapp_template_fallback ?? '',
  min_delay_minutes: row?.min_delay_minutes ?? CALLBACK_CONFIG_DEFAULTS.min_delay_minutes,
  max_delay_hours: row?.max_delay_hours ?? CALLBACK_CONFIG_DEFAULTS.max_delay_hours,
  cancel_on_resume: row?.cancel_on_resume ?? CALLBACK_CONFIG_DEFAULTS.cancel_on_resume,
});

const newTemplateId = () =>
  `tpl_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/** AC4 — regras que bloqueiam o salvamento. */
const validateCallbackDraft = (draft: DraftState): string[] => {
  const errors: string[] = [];

  if (
    draft.enabled &&
    draft.default_mode === 'direct' &&
    draft.templates.length === 0 &&
    !draft.allow_free_text
  ) {
    errors.push(
      'No modo "Automação direta" o agente não redige nada: cadastre ao menos um template ou permita texto livre da IA.',
    );
  }

  if (draft.max_delay_hours > WHATSAPP_WINDOW_HOURS && !draft.whatsapp_template_fallback) {
    errors.push(
      `Prazo máximo acima de ${WHATSAPP_WINDOW_HOURS}h: fora da janela de 24h a Meta só entrega template aprovado. Selecione um template de fallback ou reduza o prazo.`,
    );
  }

  if (draft.min_delay_minutes < 1) {
    errors.push('Antecedência mínima deve ser de pelo menos 1 minuto.');
  }

  draft.templates.forEach((tpl, i) => {
    if (!tpl.label.trim()) errors.push(`Template ${i + 1}: informe um nome (label).`);
    if (!tpl.body.trim()) errors.push(`Template ${i + 1}: informe o texto da mensagem.`);
  });

  return errors;
};

// ── Editor de templates ───────────────────────────────────────────────────────

const CallbackTemplatesEditor = ({
  templates,
  approvedTemplates,
  onChange,
}: {
  templates: CallbackTemplate[];
  approvedTemplates: Array<{ value: string; label: string }>;
  onChange: (next: CallbackTemplate[]) => void;
}) => {
  const update = (index: number, patch: Partial<CallbackTemplate>) =>
    onChange(templates.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-2">
      {templates.length === 0 && (
        <p className="text-[10px] text-muted-foreground/40 italic">
          Nenhum template cadastrado — o agente só poderá agendar retornos com texto livre (se permitido).
        </p>
      )}

      {templates.map((tpl, index) => (
        <div key={tpl.id} className="rounded-[4px] border border-border bg-muted/40 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={tpl.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder="Nome do template (ex: Retorno padrão)"
              className="h-[30px] text-sm flex-1"
            />
            <button
              type="button"
              aria-label={`Remover template ${tpl.label || index + 1}`}
              onClick={() => onChange(templates.filter((_, i) => i !== index))}
              className="text-muted-foreground/50 hover:text-red-500 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <Textarea
            value={tpl.body}
            onChange={(e) => update(index, { body: e.target.value })}
            placeholder="Mensagem enviada no horário do retorno."
            rows={2}
            className="text-sm resize-none"
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Template aprovado (WhatsApp)
              <span className="ml-1.5 text-muted-foreground/40 font-normal text-[10px]">— opcional, usado fora da janela de 24h</span>
            </Label>
            <Select
              value={tpl.whatsapp_template_name || NO_TEMPLATE}
              onValueChange={(v) =>
                update(index, { whatsapp_template_name: v === NO_TEMPLATE ? null : v })
              }
            >
              <SelectTrigger className="h-[30px] text-sm">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE}>
                  <span className="text-muted-foreground">Nenhum</span>
                </SelectItem>
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[9px] text-muted-foreground/40 font-mono">id: {tpl.id}</p>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...templates, { id: newTemplateId(), label: '', body: '', whatsapp_template_name: null }])
        }
        className="h-[28px] rounded-[4px] gap-1.5 text-xs px-3"
      >
        <Plus className="h-3 w-3" />
        Adicionar template
      </Button>
    </div>
  );
};

// ── Formulário de um escopo (default do agente ou override de step) ───────────

const CallbackConfigForm = ({
  agentId,
  stepId,
  row,
  approvedTemplates,
}: {
  agentId: string;
  stepId: string | null;
  row: AgentCallbackConfig | null;
  approvedTemplates: Array<{ value: string; label: string }>;
}) => {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(row));
  const [showErrors, setShowErrors] = useState(false);
  const upsert = useUpsertAgentCallbackConfig();

  const patch = (values: Partial<DraftState>) => setDraft((prev) => ({ ...prev, ...values }));

  const errors = validateCallbackDraft(draft);

  const handleSave = () => {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    upsert.mutate({
      ...(row?.id ? { id: row.id } : {}),
      agent_id: agentId,
      step_id: stepId,
      enabled: draft.enabled,
      default_mode: draft.default_mode,
      allow_agent_choose_mode: draft.allow_agent_choose_mode,
      allow_free_text: draft.allow_free_text,
      templates: draft.templates,
      free_prompt: draft.free_prompt.trim() ? draft.free_prompt : null,
      whatsapp_template_fallback: draft.whatsapp_template_fallback || null,
      min_delay_minutes: draft.min_delay_minutes,
      max_delay_hours: draft.max_delay_hours,
      cancel_on_resume: draft.cancel_on_resume,
    });
  };

  return (
    <div className="space-y-4">
      {/* Habilitar */}
      <div className="flex items-center gap-2">
        <Switch
          checked={draft.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
          aria-label="Habilitar tool de retorno agendado"
        />
        <span className="text-xs text-muted-foreground">
          {draft.enabled ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Tool habilitada
            </span>
          ) : 'Tool desabilitada'}
        </span>
      </div>

      {!draft.enabled && (
        <p className="text-[10px] text-muted-foreground/40 italic">
          Desabilitada — as tools <code className="font-mono">agendar_retorno</code> e{' '}
          <code className="font-mono">cancelar_retorno</code> não são expostas ao agente neste escopo.
        </p>
      )}

      {draft.enabled && (
        <>
          {/* Modo de disparo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Modo de disparo</Label>
            <RadioGroup
              value={draft.default_mode}
              onValueChange={(v) => patch({ default_mode: v as CallbackMode })}
              className="gap-1.5"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="direct" id="callback-mode-direct" />
                <Label htmlFor="callback-mode-direct" className="text-xs font-normal">
                  Automação direta (sem IA)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="agent" id="callback-mode-agent" />
                <Label htmlFor="callback-mode-agent" className="text-xs font-normal">
                  Reativar o agente de IA
                </Label>
              </div>
            </RadioGroup>
            <p className="text-[10px] text-muted-foreground/50">
              {draft.default_mode === 'direct'
                ? 'Envia a mensagem pré-definida no horário — barato e previsível.'
                : 'Reinvoca o agente no horário para ele redigir a mensagem seguindo o prompt do retorno.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={draft.allow_agent_choose_mode}
              onCheckedChange={(v) => patch({ allow_agent_choose_mode: v })}
              aria-label="Deixar o agente escolher o modo"
            />
            <span className="text-xs text-muted-foreground">Deixar o agente escolher o modo</span>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={draft.allow_free_text}
              onCheckedChange={(v) => patch({ allow_free_text: v })}
              aria-label="Permitir texto livre da IA"
            />
            <span className="text-xs text-muted-foreground">Permitir texto livre da IA</span>
          </div>

          {/* Templates */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Templates de retorno
              <span className="ml-1.5 text-muted-foreground/40 font-normal text-[10px]">— o agente escolhe pelo id</span>
            </Label>
            <CallbackTemplatesEditor
              templates={draft.templates}
              approvedTemplates={approvedTemplates}
              onChange={(templates) => patch({ templates })}
            />
          </div>

          {/* Prompt do retorno */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prompt do retorno</Label>
            <Textarea
              value={draft.free_prompt}
              onChange={(e) => patch({ free_prompt: e.target.value })}
              placeholder="Retome a conversa de onde parou, lembrando o motivo do retorno."
              rows={2}
              className="text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground/50">
              Instrução usada quando o modo é "Reativar o agente de IA".
            </p>
          </div>

          {/* Fallback fora da janela de 24h */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Template de fallback fora da janela de 24h
            </Label>
            <Select
              value={draft.whatsapp_template_fallback || NO_TEMPLATE}
              onValueChange={(v) =>
                patch({ whatsapp_template_fallback: v === NO_TEMPLATE ? '' : v })
              }
            >
              <SelectTrigger className="h-[30px] text-sm">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE}>
                  <span className="text-muted-foreground">Nenhum</span>
                </SelectItem>
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {approvedTemplates.length === 0 && (
              <p className="text-[10px] text-muted-foreground/40 italic">
                Nenhum template aprovado disponível — aprove templates em Configurações → WhatsApp.
              </p>
            )}
          </div>

          {/* Guardrails */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Antecedência mínima
                <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">min</span>
              </Label>
              <Input
                type="number" min={1} step={1}
                value={draft.min_delay_minutes}
                onChange={(e) => patch({ min_delay_minutes: parseInt(e.target.value, 10) || 0 })}
                className="h-[30px] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Prazo máximo
                <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">h</span>
              </Label>
              <Input
                type="number" min={1} step={1}
                value={draft.max_delay_hours}
                onChange={(e) => patch({ max_delay_hours: parseInt(e.target.value, 10) || 0 })}
                className="h-[30px] text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={draft.cancel_on_resume}
              onCheckedChange={(v) => patch({ cancel_on_resume: v })}
              aria-label="Cancelar automaticamente se o lead retomar a conversa"
            />
            <span className="text-xs text-muted-foreground">
              Cancelar automaticamente se o lead retomar a conversa
            </span>
          </div>
        </>
      )}

      {/* Erros de validação */}
      {showErrors && errors.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-[4px] bg-amber-500/10 border border-amber-500/25">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
              Corrija antes de salvar
            </p>
            <ul className="space-y-0.5">
              {errors.map((err) => (
                <li key={err} className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={upsert.isPending}
          className="h-[28px] rounded-[4px] gap-1.5 text-xs px-3"
        >
          <Save className="h-3 w-3" />
          {upsert.isPending ? 'Salvando...' : 'Salvar retorno'}
        </Button>
        <span className="text-[10px] text-muted-foreground/40">
          Salvo separadamente do agente.
        </span>
      </div>
    </div>
  );
};

// ── Seção ─────────────────────────────────────────────────────────────────────

export const CallbackConfigSection = ({ agentId, usaEtapas }: CallbackConfigSectionProps) => {
  const { data, isLoading, isError, error } = useAgentCallbackConfigs(agentId);
  const { data: passos = [] } = usePassosAgente(usaEtapas ? agentId : '');
  const { data: waTemplates = [] } = useWhatsappTemplates();
  const [scope, setScope] = useState<string>(DEFAULT_SCOPE);

  const approvedTemplates = useMemo(
    () =>
      waTemplates
        .filter((t) => ['approved', 'active'].includes((t.status || '').toLowerCase()))
        .map((t) => ({
          value: t.meta_template_name || t.nome,
          label: t.nome || t.meta_template_name || t.id_template,
        }))
        .filter((t) => !!t.value),
    [waTemplates],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-[30px] w-1/2" />
        <Skeleton className="h-[30px] w-full" />
        <Skeleton className="h-[60px] w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2 p-2 rounded-[4px] bg-red-500/10 border border-red-500/25">
        <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-red-600 dark:text-red-400">
          Não foi possível carregar a configuração de retorno: {error?.message}
        </p>
      </div>
    );
  }

  const stepId = scope === DEFAULT_SCOPE ? null : scope;
  const currentRow = stepId ? data?.overrides[stepId] ?? null : data?.default ?? null;
  const showScopes = usaEtapas && passos.length > 0;

  return (
    <div className="space-y-3">
      {showScopes && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Escopo da configuração
            <span className="ml-1.5 text-muted-foreground/40 font-normal">— o step usa o padrão do agente quando não tem override</span>
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: DEFAULT_SCOPE, nome: 'Padrão do agente' }, ...passos].map((item) => {
              const isActive = scope === item.id;
              const hasOverride = item.id === DEFAULT_SCOPE
                ? !!data?.default
                : !!data?.overrides[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => setScope(item.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs border transition-colors',
                    isActive
                      ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                      : 'bg-muted border-border text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {hasOverride && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                  {item.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showScopes && stepId && !currentRow && (
        <p className="text-[10px] text-primary/60 italic">
          Este step ainda não tem override — os valores abaixo partem dos padrões e só passam a valer após salvar.
        </p>
      )}

      <CallbackConfigForm
        key={`${scope}:${currentRow?.id ?? 'new'}:${currentRow?.updated_at ?? ''}`}
        agentId={agentId}
        stepId={stepId}
        row={currentRow}
        approvedTemplates={approvedTemplates}
      />
    </div>
  );
};
