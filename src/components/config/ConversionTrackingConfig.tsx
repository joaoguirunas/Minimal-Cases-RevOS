import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  GitBranch,
  Trophy,
  XCircle,
  UserPlus,
  CalendarCheck,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useLeadsPipelines, useLeadsStages } from "@/hooks/useLeadsPipelines";
import { useBIProAdAccounts } from "@/hooks/useBIProAdAccounts";
import {
  useConversionRules,
  useCreateConversionRule,
  useUpdateConversionRule,
  useDeleteConversionRule,
  useMetaPixels,
  useGoogleConversionActions,
  useConversionEvents,
  type ConversionEventRule,
  type TriggerType,
} from "@/hooks/useConversionConfig";

// ─── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_TYPES: { value: TriggerType; label: string; icon: typeof Zap; description: string }[] = [
  { value: "stage_enter", label: "Entra em etapa", icon: GitBranch, description: "Quando lead entra em uma etapa específica do pipeline" },
  { value: "lead_won", label: "Lead ganho", icon: Trophy, description: "Quando um lead é marcado como ganho" },
  { value: "lead_lost", label: "Lead perdido", icon: XCircle, description: "Quando um lead é marcado como perdido" },
  { value: "lead_created", label: "Lead criado", icon: UserPlus, description: "Quando um novo lead é criado" },
  { value: "booking_status", label: "Status de agendamento", icon: CalendarCheck, description: "Quando o status de um agendamento muda" },
];

const BOOKING_STATUSES = [
  { value: "compareceu", label: "Compareceu" },
  { value: "nao_compareceu", label: "Não compareceu" },
  { value: "agendado", label: "Agendado" },
  { value: "cancelado", label: "Cancelado" },
];

const META_EVENT_SUGGESTIONS = [
  { value: "Lead", label: "Lead" },
  { value: "CompleteRegistration", label: "Complete Registration" },
  { value: "Schedule", label: "Schedule" },
  { value: "InitiateCheckout", label: "Initiate Checkout" },
  { value: "Purchase", label: "Purchase" },
  { value: "Subscribe", label: "Subscribe" },
  { value: "Contact", label: "Contact" },
  { value: "SubmitApplication", label: "Submit Application" },
];

const MANUAL_PIXEL_VALUE = "__manual__";
const CUSTOM_EVENT_VALUE = "__custom__";

// ─── Trigger label helper ───────────────────────────────────────────────────

function getTriggerLabel(rule: ConversionEventRule, pipelines: any[], stages: any[]) {
  const tt = TRIGGER_TYPES.find((t) => t.value === rule.trigger_type);
  if (!tt) return rule.trigger_type;

  if (rule.trigger_type === "stage_enter") {
    const stageId = rule.trigger_config?.stage_id as string;
    const stageName = rule.trigger_config?.stage_name as string;
    if (stageName) return `Entra em "${stageName}"`;
    const stage = stages.find((s: any) => s.id === stageId);
    return stage ? `Entra em "${stage.name}"` : tt.label;
  }

  if (rule.trigger_type === "booking_status") {
    const status = rule.trigger_config?.status as string;
    const bs = BOOKING_STATUSES.find((b) => b.value === status);
    return bs ? `Agendamento: ${bs.label}` : tt.label;
  }

  return tt.label;
}

// ─── Rule Card ──────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  pipelines,
  stages,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: ConversionEventRule;
  pipelines: any[];
  stages: any[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  const tt = TRIGGER_TYPES.find((t) => t.value === rule.trigger_type);
  const TriggerIcon = tt?.icon || Zap;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer ${
        !rule.active ? "opacity-60" : ""
      }`}
      onClick={onEdit}
    >
      {/* Left */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <TriggerIcon
          className={`w-4 h-4 flex-shrink-0 ${rule.active ? "text-muted-foreground/70" : "text-muted-foreground/40"}`}
          strokeWidth={1.5}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">{rule.name}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-border">
              {getTriggerLabel(rule, pipelines, stages)}
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {rule.meta_enabled && (
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-200/30 text-[10px] px-1.5 py-0 font-normal">
                Meta · {rule.meta_event_name || "—"}
                {rule.meta_send_value && " · $"}
              </Badge>
            )}
            {rule.google_enabled && (
              <Badge className="bg-red-500/10 text-red-600 border-red-200/30 text-[10px] px-1.5 py-0 font-normal">
                Google · {rule.google_conversion_action_name || rule.google_conversion_action_id || "—"}
                {rule.google_send_value && " · $"}
              </Badge>
            )}
            {!rule.meta_enabled && !rule.google_enabled && (
              <span className="text-[11px] text-muted-foreground/40">Nenhuma plataforma habilitada</span>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <Switch checked={rule.active} onCheckedChange={onToggle} className="scale-90" />
        <Button
          size="sm"
          variant="ghost"
          className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}

// ─── Rule Editor Dialog ─────────────────────────────────────────────────────

interface RuleFormState {
  name: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  meta_enabled: boolean;
  meta_pixel_id: string;
  meta_event_name: string;
  meta_send_value: boolean;
  google_enabled: boolean;
  google_account_id: string;
  google_conversion_action_id: string;
  google_conversion_action_name: string;
  google_send_value: boolean;
  google_currency: string;
  active: boolean;
}

const emptyForm: RuleFormState = {
  name: "",
  trigger_type: "stage_enter",
  trigger_config: {},
  meta_enabled: false,
  meta_pixel_id: "",
  meta_event_name: "",
  meta_send_value: false,
  google_enabled: false,
  google_account_id: "",
  google_conversion_action_id: "",
  google_conversion_action_name: "",
  google_send_value: false,
  google_currency: "BRL",
  active: true,
};

function RuleEditorDialog({
  open,
  onOpenChange,
  editingRule,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: ConversionEventRule | null;
  onSave: (form: RuleFormState) => void;
  isSaving: boolean;
}) {
  const { data: pipelines } = useLeadsPipelines();
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const { data: stages } = useLeadsStages(selectedPipeline || undefined);
  const { data: metaData, isLoading: loadingPixels } = useMetaPixels();
  const metaPixels = metaData?.pixels;
  const metaErrors = metaData?.errors;
  const { data: googleData, isLoading: loadingActions } = useGoogleConversionActions();
  const googleActions = googleData?.actions;
  const googleErrors = googleData?.errors;
  const { metaAccounts, googleAccounts } = useBIProAdAccounts();

  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [manualPixel, setManualPixel] = useState(false);
  const [customMetaEvent, setCustomMetaEvent] = useState(false);
  const [manualGoogleAction, setManualGoogleAction] = useState(false);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      if (editingRule) {
        setForm({
          name: editingRule.name,
          trigger_type: editingRule.trigger_type,
          trigger_config: editingRule.trigger_config || {},
          meta_enabled: editingRule.meta_enabled,
          meta_pixel_id: editingRule.meta_pixel_id || "",
          meta_event_name: editingRule.meta_event_name || "",
          meta_send_value: editingRule.meta_send_value,
          google_enabled: editingRule.google_enabled,
          google_account_id: editingRule.google_account_id || "",
          google_conversion_action_id: editingRule.google_conversion_action_id || "",
          google_conversion_action_name: editingRule.google_conversion_action_name || "",
          google_send_value: editingRule.google_send_value,
          google_currency: editingRule.google_currency || "BRL",
          active: editingRule.active,
        });
        if (editingRule.trigger_type === "stage_enter" && editingRule.trigger_config?.pipeline_id) {
          setSelectedPipeline(editingRule.trigger_config.pipeline_id as string);
        }
        const knownPixelIds = metaPixels?.map((p) => p.id) || [];
        if (editingRule.meta_pixel_id && !knownPixelIds.includes(editingRule.meta_pixel_id)) {
          setManualPixel(true);
        }
        const knownEventNames = META_EVENT_SUGGESTIONS.map((s) => s.value);
        if (editingRule.meta_event_name && !knownEventNames.includes(editingRule.meta_event_name)) {
          setCustomMetaEvent(true);
        }
      } else {
        setForm(emptyForm);
        setSelectedPipeline("");
        setManualPixel(false);
        setCustomMetaEvent(false);
        setManualGoogleAction(false);
      }
    }

    if (!open && prevOpen.current) {
      setManualPixel(false);
      setCustomMetaEvent(false);
      setManualGoogleAction(false);
    }

    prevOpen.current = open;
  }, [open, editingRule, metaPixels]);

  const updateForm = (patch: Partial<RuleFormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Nome da regra é obrigatório");
      return;
    }
    if (!form.meta_enabled && !form.google_enabled) {
      toast.error("Habilite pelo menos uma plataforma (Meta ou Google)");
      return;
    }
    if (form.trigger_type === "stage_enter" && !form.trigger_config.stage_id) {
      toast.error("Selecione a etapa do pipeline");
      return;
    }
    if (form.trigger_type === "booking_status" && !form.trigger_config.status) {
      toast.error("Selecione o status do agendamento");
      return;
    }
    onSave(form);
  };

  const selectedTrigger = TRIGGER_TYPES.find((t) => t.value === form.trigger_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{editingRule ? "Editar Regra" : "Nova Regra de Conversão"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Nome da regra</Label>
            <Input
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="Ex: Lead Qualificado → Meta + Google"
              className="h-[30px] text-[13px]"
            />
          </div>

          {/* Trigger Type */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Gatilho</Label>
            <Select
              value={form.trigger_type}
              onValueChange={(v) => updateForm({ trigger_type: v as TriggerType, trigger_config: {} })}
            >
              <SelectTrigger className="h-[30px] text-[13px]">
                <SelectValue placeholder="Selecione o gatilho..." />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((tt) => {
                  const Icon = tt.icon;
                  return (
                    <SelectItem key={tt.value} value={tt.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                        <span>{tt.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedTrigger && (
              <p className="text-[11px] text-muted-foreground/60">{selectedTrigger.description}</p>
            )}
          </div>

          {/* Trigger Config: stage_enter */}
          {form.trigger_type === "stage_enter" && (
            <div className="space-y-2 rounded-[2px] border border-border bg-muted p-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Pipeline e Etapa
              </p>
              <Select
                value={selectedPipeline}
                onValueChange={(v) => {
                  setSelectedPipeline(v);
                  updateForm({ trigger_config: { pipeline_id: v } });
                }}
              >
                <SelectTrigger className="h-[30px] text-[13px]">
                  <SelectValue placeholder="Selecione o pipeline..." />
                </SelectTrigger>
                <SelectContent>
                  {pipelines?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPipeline && stages?.length ? (
                <Select
                  value={(form.trigger_config.stage_id as string) || ""}
                  onValueChange={(v) => {
                    const stage = stages.find((s) => s.id === v);
                    updateForm({
                      trigger_config: {
                        ...form.trigger_config,
                        stage_id: v,
                        stage_name: stage?.name || "",
                      },
                    });
                  }}
                >
                  <SelectTrigger className="h-[30px] text-[13px]">
                    <SelectValue placeholder="Selecione a etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color || "#6b7280" }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : selectedPipeline ? (
                <p className="text-[12px] text-muted-foreground/60">Nenhuma etapa encontrada</p>
              ) : null}
            </div>
          )}

          {/* Trigger Config: booking_status */}
          {form.trigger_type === "booking_status" && (
            <div className="space-y-1.5 rounded-[2px] border border-border bg-muted p-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Status do agendamento
              </p>
              <Select
                value={(form.trigger_config.status as string) || ""}
                onValueChange={(v) => updateForm({ trigger_config: { status: v } })}
              >
                <SelectTrigger className="h-[30px] text-[13px]">
                  <SelectValue placeholder="Selecione o status..." />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_STATUSES.map((bs) => (
                    <SelectItem key={bs.value} value={bs.value}>{bs.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Meta CAPI ────────────────────────────────────────────────── */}
          <div className="space-y-3 rounded-[2px] border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-[13px] font-medium">Meta (Conversions API)</span>
              </div>
              <Switch checked={form.meta_enabled} onCheckedChange={(v) => updateForm({ meta_enabled: v })} className="scale-90" />
            </div>

            {form.meta_enabled && (
              <div className="space-y-3 pt-1 border-t border-border">
                {/* Meta API errors */}
                {metaErrors && metaErrors.length > 0 && (
                  <div className="flex items-start gap-2 rounded-[4px] border border-red-200/30 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium">Erro ao buscar pixels Meta:</p>
                      {metaErrors.map((err, i) => (
                        <p key={i} className="mt-0.5">{err}</p>
                      ))}
                      <p className="mt-1 text-muted-foreground/60">
                        Verifique se o token da conta Meta ainda é válido em Integrações.
                      </p>
                    </div>
                  </div>
                )}

                {/* Pixel selector */}
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Pixel</Label>
                  {metaAccounts.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-[4px] border border-amber-200/30 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      Conecte uma conta Meta em Integrações primeiro
                    </div>
                  ) : loadingPixels ? (
                    <div className="h-[30px] bg-muted animate-pulse rounded-[4px]" />
                  ) : manualPixel ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={form.meta_pixel_id}
                        onChange={(e) => updateForm({ meta_pixel_id: e.target.value })}
                        placeholder="Digite o Pixel ID (ex: 123456789)"
                        className="h-[30px] text-[13px] flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-[30px] text-[13px] shrink-0"
                        onClick={() => { setManualPixel(false); updateForm({ meta_pixel_id: "" }); }}
                      >
                        Lista
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={form.meta_pixel_id || ""}
                      onValueChange={(v) => {
                        if (v === MANUAL_PIXEL_VALUE) {
                          setManualPixel(true);
                          updateForm({ meta_pixel_id: "" });
                        } else {
                          updateForm({ meta_pixel_id: v });
                        }
                      }}
                    >
                      <SelectTrigger className="h-[30px] text-[13px]">
                        <SelectValue placeholder="Selecione o pixel..." />
                      </SelectTrigger>
                      <SelectContent>
                        {metaPixels?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.id})
                          </SelectItem>
                        ))}
                        <SelectItem value={MANUAL_PIXEL_VALUE}>
                          <span className="text-muted-foreground">Digitar manualmente...</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Event name */}
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Evento</Label>
                  {customMetaEvent ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={form.meta_event_name}
                        onChange={(e) => updateForm({ meta_event_name: e.target.value })}
                        placeholder="Nome do evento customizado"
                        className="h-[30px] text-[13px] flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-[30px] text-[13px] shrink-0"
                        onClick={() => { setCustomMetaEvent(false); updateForm({ meta_event_name: "" }); }}
                      >
                        Lista
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={form.meta_event_name || ""}
                      onValueChange={(v) => {
                        if (v === CUSTOM_EVENT_VALUE) {
                          setCustomMetaEvent(true);
                          updateForm({ meta_event_name: "" });
                        } else {
                          updateForm({ meta_event_name: v });
                        }
                      }}
                    >
                      <SelectTrigger className="h-[30px] text-[13px]">
                        <SelectValue placeholder="Selecione o evento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {META_EVENT_SUGGESTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_EVENT_VALUE}>
                          <span className="text-muted-foreground">Evento customizado...</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Send value */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.meta_send_value}
                    onCheckedChange={(v) => updateForm({ meta_send_value: v })}
                    className="scale-90"
                  />
                  <Label className="text-[12px] text-muted-foreground/60 cursor-pointer">
                    Enviar valor do negócio
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* ── Google Ads ───────────────────────────────────────────────── */}
          <div className="space-y-3 rounded-[2px] border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-[13px] font-medium">Google Ads</span>
              </div>
              <Switch checked={form.google_enabled} onCheckedChange={(v) => updateForm({ google_enabled: v })} className="scale-90" />
            </div>

            {form.google_enabled && (
              <div className="space-y-3 pt-1 border-t border-border">
                {/* Google API errors */}
                {googleErrors && googleErrors.length > 0 && (
                  <div className="flex items-start gap-2 rounded-[4px] border border-red-200/30 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium">Erro ao buscar ações de conversão Google:</p>
                      {googleErrors.map((err, i) => (
                        <p key={i} className="mt-0.5">{err}</p>
                      ))}
                      <p className="mt-1 text-muted-foreground/60">
                        Verifique credenciais Google Ads em Integrações.
                      </p>
                    </div>
                  </div>
                )}

                {/* Account selector */}
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Conta</Label>
                  {googleAccounts.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-[4px] border border-amber-200/30 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      Conecte uma conta Google Ads em Integrações primeiro
                    </div>
                  ) : (
                    <Select value={form.google_account_id} onValueChange={(v) => updateForm({ google_account_id: v })}>
                      <SelectTrigger className="h-[30px] text-[13px]">
                        <SelectValue placeholder="Selecione a conta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {googleAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.account_id}>
                            {a.account_name} ({a.account_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Conversion action */}
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Ação de conversão</Label>
                  {loadingActions ? (
                    <div className="h-[30px] bg-muted animate-pulse rounded-[4px]" />
                  ) : manualGoogleAction ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={form.google_conversion_action_id}
                        onChange={(e) => updateForm({ google_conversion_action_id: e.target.value })}
                        placeholder="Digite o ID da ação de conversão"
                        className="h-[30px] text-[13px] flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-[30px] text-[13px] shrink-0"
                        onClick={() => { setManualGoogleAction(false); updateForm({ google_conversion_action_id: "", google_conversion_action_name: "" }); }}
                      >
                        Lista
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={form.google_conversion_action_id || ""}
                      onValueChange={(v) => {
                        if (v === MANUAL_PIXEL_VALUE) {
                          setManualGoogleAction(true);
                          updateForm({ google_conversion_action_id: "", google_conversion_action_name: "" });
                        } else {
                          const action = googleActions?.find((a) => a.id === v);
                          updateForm({
                            google_conversion_action_id: v,
                            google_conversion_action_name: action?.name || "",
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-[30px] text-[13px]">
                        <SelectValue placeholder="Selecione a conversão..." />
                      </SelectTrigger>
                      <SelectContent>
                        {googleActions
                          ?.filter((a) => !form.google_account_id || a.account_id === form.google_account_id.replace(/-/g, ''))
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} ({a.type})
                            </SelectItem>
                          ))}
                        {(!googleActions || googleActions.length === 0) && (
                          <div className="px-2 py-1.5 text-[12px] text-muted-foreground/60">
                            Nenhuma ação encontrada
                          </div>
                        )}
                        <SelectItem value={MANUAL_PIXEL_VALUE}>
                          <span className="text-muted-foreground">Digitar manualmente...</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Send value */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.google_send_value}
                    onCheckedChange={(v) => updateForm({ google_send_value: v })}
                    className="scale-90"
                  />
                  <Label className="text-[12px] text-muted-foreground/60 cursor-pointer">
                    Enviar valor do negócio
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" size="sm" className="h-[30px] text-[13px]" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" className="h-[30px] text-[13px] gap-1.5" onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {editingRule ? "Salvar" : "Criar Regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Events Log ─────────────────────────────────────────────────────────────

function ConversionEventsLog() {
  const { data: events, isLoading, refetch } = useConversionEvents({ limit: 50 });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded-[2px]" />
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="border border-border rounded-[2px] p-8 text-center">
        <BarChart3 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-[13px] text-muted-foreground">Nenhum evento registrado ainda</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          Eventos aparecerão aqui quando leads acionarem suas regras
        </p>
      </div>
    );
  }

  const statusDot = (s: string) => {
    if (s === "sent") return "bg-green-500";
    if (s === "failed") return "bg-red-500";
    if (s === "skipped") return "bg-muted-foreground/30";
    return "bg-amber-500";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Log de Envios
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Button>
      </div>
      <div className="border border-border rounded-[2px] overflow-hidden">
        <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
          {events.map((evt: Record<string, unknown>) => {
            const lead = evt.lead as Record<string, unknown> | null;
            const stage = evt.stage as Record<string, unknown> | null;
            const person = lead?.clients_people as Record<string, unknown> | null;
            const eventData = evt.event_data as Record<string, unknown>;
            const isExpanded = expanded === (evt.id as string);
            const metaStatus = evt.meta_status as string;
            const googleStatus = evt.google_status as string;

            const overallStatus =
              metaStatus === "skipped" && googleStatus === "skipped"
                ? "skipped"
                : metaStatus === "sent" || googleStatus === "sent"
                  ? "sent"
                  : metaStatus === "failed" || googleStatus === "failed"
                    ? "failed"
                    : "pending";

            return (
              <div key={evt.id as string} className="px-4 py-2.5 hover:bg-muted/50 transition-colors">
                <div
                  className="flex cursor-pointer items-center gap-2"
                  onClick={() => setExpanded(isExpanded ? null : (evt.id as string))}
                >
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDot(overallStatus)}`} />
                  <span className="text-[13px] font-medium text-foreground truncate">
                    {(person?.name as string) || (lead?.title as string) || "—"}
                  </span>
                  {eventData?.rule_name && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-border">
                      {eventData.rule_name as string}
                    </Badge>
                  )}
                  <span className="text-[12px] text-muted-foreground/60 truncate">
                    {(stage?.name as string) || "—"}
                  </span>
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    {metaStatus !== "skipped" && (
                      <Badge
                        className={`text-[10px] px-1.5 py-0 font-normal ${
                          metaStatus === "sent"
                            ? "bg-blue-500/10 text-blue-600 border-blue-200/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        Meta: {metaStatus}
                      </Badge>
                    )}
                    {googleStatus !== "skipped" && (
                      <Badge
                        className={`text-[10px] px-1.5 py-0 font-normal ${
                          googleStatus === "sent"
                            ? "bg-red-500/10 text-red-600 border-red-200/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        Google: {googleStatus}
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <pre className="mt-2 p-3 bg-muted border border-border rounded-[4px] max-h-48 overflow-auto text-[11px] text-muted-foreground">
                    {JSON.stringify(
                      {
                        event_data: evt.event_data,
                        meta_response: evt.meta_response,
                        google_response: evt.google_response,
                        skip_reason: evt.skip_reason,
                      },
                      null,
                      2,
                    )}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function ConversionTrackingConfig() {
  const { data: rules, isLoading: loadingRules } = useConversionRules();
  const { data: pipelines } = useLeadsPipelines();
  const { data: allStages } = useLeadsStages();
  const createRule = useCreateConversionRule();
  const updateRule = useUpdateConversionRule();
  const deleteRule = useDeleteConversionRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ConversionEventRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversionEventRule | null>(null);

  const activeRules = useMemo(() => rules?.filter((r) => r.active) || [], [rules]);
  const inactiveRules = useMemo(() => rules?.filter((r) => !r.active) || [], [rules]);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: ConversionEventRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleSave = (form: RuleFormState) => {
    const payload = {
      name: form.name,
      trigger_type: form.trigger_type,
      trigger_config: form.trigger_config,
      meta_enabled: form.meta_enabled,
      meta_pixel_id: form.meta_enabled ? form.meta_pixel_id || null : null,
      meta_event_name: form.meta_enabled ? form.meta_event_name || null : null,
      meta_send_value: form.meta_send_value,
      google_enabled: form.google_enabled,
      google_account_id: form.google_enabled ? form.google_account_id || null : null,
      google_conversion_action_id: form.google_enabled ? form.google_conversion_action_id || null : null,
      google_conversion_action_name: form.google_enabled ? form.google_conversion_action_name || null : null,
      google_send_value: form.google_send_value,
      google_currency: form.google_currency || "BRL",
      active: form.active,
    };

    if (editingRule) {
      updateRule.mutate(
        { id: editingRule.id, ...payload },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createRule.mutate(payload as any, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteRule.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleToggle = (rule: ConversionEventRule, active: boolean) => {
    updateRule.mutate({ id: rule.id, active });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Conversões</h3>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            Retroalimente Meta e Google Ads automaticamente quando leads avançam no funil.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="h-[30px] text-[13px] gap-1.5">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Nova Regra
        </Button>
      </div>

      {/* Rules list */}
      {loadingRules ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded-[2px]" />
          ))}
        </div>
      ) : !rules?.length ? (
        <div className="border border-border rounded-[2px] p-8 text-center">
          <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground">Nenhuma regra configurada</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1 max-w-sm mx-auto">
            Crie regras para enviar eventos de conversão ao Meta e Google Ads quando leads
            mudarem de etapa, forem ganhos, ou tiverem agendamentos atualizados.
          </p>
          <Button onClick={handleOpenCreate} variant="outline" size="sm" className="mt-4 h-[30px] text-[13px] gap-1.5">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Criar primeira regra
          </Button>
        </div>
      ) : (
        <div>
          {activeRules.length > 0 && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
              Ativas ({activeRules.length})
            </p>
          )}
          <div className="border border-border rounded-[2px] overflow-hidden">
            {activeRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                pipelines={pipelines || []}
                stages={allStages || []}
                onEdit={() => handleOpenEdit(rule)}
                onDelete={() => setDeleteTarget(rule)}
                onToggle={(active) => handleToggle(rule, active)}
              />
            ))}
          </div>

          {inactiveRules.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mt-4 mb-1">
                Inativas ({inactiveRules.length})
              </p>
              <div className="border border-border rounded-[2px] overflow-hidden">
                {inactiveRules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    pipelines={pipelines || []}
                    stages={allStages || []}
                    onEdit={() => handleOpenEdit(rule)}
                    onDelete={() => setDeleteTarget(rule)}
                    onToggle={(active) => handleToggle(rule, active)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Events log */}
      <ConversionEventsLog />

      {/* Rule editor dialog */}
      <RuleEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingRule={editingRule}
        onSave={handleSave}
        isSaving={createRule.isPending || updateRule.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Remover regra</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Tem certeza que deseja remover a regra "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-[30px] text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="h-[30px] text-[13px] bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
