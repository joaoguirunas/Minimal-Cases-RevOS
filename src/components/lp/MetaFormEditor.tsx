import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  Layers,
  Zap,
  GitBranch,
  Plus,
  X,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Target,
  CalendarDays,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import {
  useUpdateMetaLeadForm,
  type MetaLeadForm,
  type MetaFieldMapping,
  type MetaRawQuestion,
  type MetaLeadFormSettings,
  type MetaPostSubmitAction,
  type MetaSuccessRoute,
} from "@/hooks/useMetaLeadForms";
import {
  useScoreCategories,
  useAllScoreCategoryItems,
  type ScoreCategory,
  type ScoreCategoryItem,
} from "@/hooks/useScoreCategories";
import { usePipelines } from "@/hooks/usePipelines";
import { useWhatsappChannels } from "@/hooks/useWhatsappChannels";
import { useWhatsappTemplates } from "@/hooks/useWhatsappTemplates";
import { useBookingRuleSets } from "@/hooks/useBookingRuleSets";
import { useScoreMatrix } from "@/hooks/useScoreMatrix";
import { WhatsappTemplatePreview } from "@/components/config/WhatsappTemplatePreview";
import type { WhatsappTemplate } from "@/hooks/useWhatsappTemplates";

// ─── Constants ───────────────────────────────────────────────────────────────

const SLUG_TO_LEGACY_KEY: Record<string, string> = {
  objectives: "objetivo",
  investments: "investimento",
  framings: "enquadramento",
};

type SidebarTab = "mapping" | "pipeline" | "automations" | "success";

interface MetaFormEditorProps {
  form: MetaLeadForm;
  onBack: () => void;
}

// ─── CRM field options ───────────────────────────────────────────────────────

interface CrmFieldOption {
  value: string;
  label: string;
  group: string;
}

const STATIC_CRM_FIELDS: CrmFieldOption[] = [
  { value: "pessoa.nome", label: "Nome", group: "Pessoa" },
  { value: "pessoa.email", label: "Email", group: "Pessoa" },
  { value: "pessoa.whatsapp", label: "WhatsApp", group: "Pessoa" },
  { value: "pessoa.cidade", label: "Cidade", group: "Pessoa" },
  { value: "pessoa.estado", label: "Estado", group: "Pessoa" },
  { value: "pessoa.cep", label: "CEP", group: "Pessoa" },
  { value: "empresa.nome", label: "Nome da empresa", group: "Empresa" },
  { value: "empresa.email", label: "Email da empresa", group: "Empresa" },
  { value: "empresa.telefone", label: "Telefone", group: "Empresa" },
  { value: "empresa.website", label: "Website", group: "Empresa" },
  { value: "empresa.segmento", label: "Segmento", group: "Empresa" },
  { value: "lead.observacoes", label: "Observacoes", group: "Outros" },
];

function buildScoreCrmFields(categories: ScoreCategory[]): CrmFieldOption[] {
  return categories
    .filter((c) => c.active)
    .map((c) => {
      const legacyKey = c.slug ? SLUG_TO_LEGACY_KEY[c.slug] : null;
      const crmValue = legacyKey ? `score.${legacyKey}` : `score.${c.id}`;
      return { value: crmValue, label: c.name, group: "Score" };
    });
}

function getCategoryIdFromCrmField(
  crmField: string,
  categories: ScoreCategory[]
): string | null {
  if (!crmField.startsWith("score.")) return null;
  const key = crmField.slice(6);
  for (const cat of categories) {
    if (cat.slug && SLUG_TO_LEGACY_KEY[cat.slug] === key) return cat.id;
  }
  const byId = categories.find((c) => c.id === key);
  return byId?.id ?? null;
}

// ─── Score color helper ──────────────────────────────────────────────────────

function scoreColor(n: number) {
  return n >= 8
    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
    : n >= 5
    ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
    : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
}

// ─── Template preview helper ─────────────────────────────────────────────────

function getTemplatePreviewComponents(tpl: WhatsappTemplate | undefined) {
  if (!tpl?.json_data) return [];

  const result: Array<{ type: string; text?: string; buttons?: Array<{ text: string; type: string }> }> = [];

  // Meta native format (components array)
  if (Array.isArray(tpl.json_data.components)) {
    for (const c of tpl.json_data.components as Array<Record<string, unknown>>) {
      const type = (c.type as string)?.toUpperCase();
      if ((type === "HEADER" || type === "BODY" || type === "FOOTER") && c.text) {
        result.push({ type, text: c.text as string });
      } else if (type === "BUTTONS" && Array.isArray(c.buttons)) {
        result.push({
          type: "BUTTONS",
          buttons: (c.buttons as Array<Record<string, unknown>>).map((b) => ({
            text: (b.text as string) ?? "",
            type: (b.type as string) ?? "QUICK_REPLY",
          })),
        });
      }
    }
    return result;
  }

  // Gupshup legacy format (containerMeta string)
  let containerMeta: Record<string, unknown> = {};
  try {
    if (tpl.json_data.containerMeta) {
      containerMeta = JSON.parse(tpl.json_data.containerMeta as string);
    }
  } catch { /* ignore */ }

  if (containerMeta.header) result.push({ type: "HEADER", text: containerMeta.header as string });
  const bodyText = (containerMeta.data as string) || tpl.json_data.data;
  if (bodyText) result.push({ type: "BODY", text: bodyText });
  if (containerMeta.footer) result.push({ type: "FOOTER", text: containerMeta.footer as string });
  if (Array.isArray(containerMeta.buttons)) {
    result.push({ type: "BUTTONS", buttons: containerMeta.buttons as Array<{ text: string; type: string }> });
  }

  return result;
}

// ─── Sidebar tabs config ─────────────────────────────────────────────────────

const SIDEBAR_TABS: { key: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { key: "mapping", label: "Mapeamento", icon: <Layers className="w-4 h-4" /> },
  { key: "pipeline", label: "Pipeline", icon: <Zap className="w-4 h-4" /> },
  { key: "automations", label: "Envios", icon: <GitBranch className="w-4 h-4" /> },
  { key: "success", label: "Sucesso", icon: <CheckCircle className="w-4 h-4" /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function MetaFormEditor({ form, onBack }: MetaFormEditorProps) {
  // ── Local state ──
  const [activeTab, setActiveTab] = useState<SidebarTab>("mapping");
  const [formName, setFormName] = useState(form.name);
  const [fieldMapping, setFieldMapping] = useState<MetaFieldMapping[]>(
    form.field_mapping ?? []
  );
  const [pipelineId, setPipelineId] = useState(form.pipeline_id ?? "");
  const [initialStageId, setInitialStageId] = useState<string>(
    (form.settings as MetaLeadFormSettings)?.initial_stage_id ?? ""
  );
  const [postSubmitActions, setPostSubmitActions] = useState<MetaPostSubmitAction[]>(
    (form.settings?.post_submit_actions as MetaPostSubmitAction[] | undefined) ?? []
  );
  const [successRoutes, setSuccessRoutes] = useState<MetaSuccessRoute[]>(
    (form.settings as MetaLeadFormSettings)?.success_routes ?? []
  );
  const [successTitle, setSuccessTitle] = useState(
    (form.settings as MetaLeadFormSettings)?.success_title ?? ""
  );
  const [successMessage, setSuccessMessage] = useState(
    (form.settings as MetaLeadFormSettings)?.success_message ?? ""
  );
  const [redirectUrl, setRedirectUrl] = useState(
    (form.settings as MetaLeadFormSettings)?.redirect_url ?? ""
  );
  const [saving, setSaving] = useState(false);

  // ── Hooks ──
  const updateForm = useUpdateMetaLeadForm();
  const { data: categories = [] } = useScoreCategories();
  const { data: allScoreItems = [] } = useAllScoreCategoryItems();
  const { pipelines, stages } = usePipelines();
  const { data: channels = [] } = useWhatsappChannels();
  const { data: allTemplates = [] } = useWhatsappTemplates();
  const { data: bookingRuleSets = [] } = useBookingRuleSets();
  const { data: scoreMatrices = [] } = useScoreMatrix();
  const [outboundWebhooks, setOutboundWebhooks] = useState<{ id: string; name: string; channel: string }[]>([]);

  // Load outbound webhooks for email/SMS actions
  useEffect(() => {
    supabase
      .from("omni_outbound_webhooks")
      .select("id,name,channel")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setOutboundWebhooks(data as { id: string; name: string; channel: string }[]);
      });
  }, []);

  const templates = useMemo(
    () => allTemplates.filter((t) => t.status === "approved" || t.status === "active"),
    [allTemplates]
  );

  const rawQuestions: MetaRawQuestion[] = form.raw_questions ?? [];

  // ── CRM fields ──
  const crmFields = useMemo(
    () => [...STATIC_CRM_FIELDS, ...buildScoreCrmFields(categories)],
    [categories]
  );

  // ── Mapping helpers ──
  const getMappingForQuestion = useCallback(
    (questionKey: string) => fieldMapping.find((m) => m.meta_field === questionKey),
    [fieldMapping]
  );

  const setMappingForQuestion = useCallback(
    (question: MetaRawQuestion, crmField: string) => {
      setFieldMapping((prev) => {
        const existing = prev.findIndex((m) => m.meta_field === question.key);
        if (crmField === "__none__") {
          return existing >= 0 ? prev.filter((_, i) => i !== existing) : prev;
        }
        const entry: MetaFieldMapping = {
          crm_field: crmField,
          meta_field: question.key,
          meta_type: question.type === "PREFILLED" ? "prefilled" : "custom",
          label: question.label,
          options_mapping: existing >= 0 ? prev[existing].options_mapping : undefined,
        };
        if (existing >= 0) {
          const prevCrm = prev[existing].crm_field;
          if (prevCrm !== crmField) {
            entry.options_mapping = undefined;
          }
          const updated = [...prev];
          updated[existing] = entry;
          return updated;
        }
        return [...prev, entry];
      });
    },
    []
  );

  const setOptionsMapping = useCallback(
    (questionKey: string, metaOptionValue: string, scoreItemId: string) => {
      setFieldMapping((prev) =>
        prev.map((m) => {
          if (m.meta_field !== questionKey) return m;
          const current = m.options_mapping ?? {};
          const updated = { ...current };
          if (scoreItemId === "__none__") {
            delete updated[metaOptionValue];
          } else {
            updated[metaOptionValue] = scoreItemId;
          }
          return { ...m, options_mapping: updated };
        })
      );
    },
    []
  );

  // ── Pipeline ──
  const pipelineStages = useMemo(
    () =>
      pipelineId
        ? stages
            .filter((s) => s.leads_pipelines_id === pipelineId)
            .sort((a, b) => a.order_index - b.order_index)
        : [],
    [pipelineId, stages]
  );

  // ── Post-submit actions helpers ──
  const addPostSubmitAction = useCallback(() => {
    const newAction: MetaPostSubmitAction = {
      id: crypto.randomUUID(),
      enabled: true,
      channel: "whatsapp",
      delay_minutes: 0,
      wa_channel_id: "",
      wa_template_id: "",
      wa_variable_map: {},
    };
    setPostSubmitActions((prev) => [...prev, newAction]);
  }, []);

  const removePostSubmitAction = useCallback((id: string) => {
    setPostSubmitActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const patchPostSubmitAction = useCallback(
    (id: string, partial: Partial<MetaPostSubmitAction>) => {
      setPostSubmitActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...partial } : a))
      );
    },
    []
  );

  // ── Success routes helpers ──
  const addSuccessRoute = useCallback(() => {
    setSuccessRoutes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        matrix_ids: [],
        action: "message" as const,
        title: "",
        message: "",
      },
    ]);
  }, []);

  const removeSuccessRoute = useCallback((id: string) => {
    setSuccessRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const patchSuccessRoute = useCallback(
    (id: string, partial: Partial<MetaSuccessRoute>) => {
      setSuccessRoutes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...partial } : r))
      );
    },
    []
  );

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const hasMapping = fieldMapping.length > 0;
      const newStatus = hasMapping ? "active" : "unmapped";
      const settings: MetaLeadFormSettings = {
        ...(form.settings ?? {}),
        initial_stage_id: initialStageId || undefined,
        post_submit_actions: postSubmitActions,
        success_routes: successRoutes,
        success_title: successTitle || undefined,
        success_message: successMessage || undefined,
        redirect_url: redirectUrl || undefined,
      };

      await updateForm.mutateAsync({
        id: form.id,
        name: formName,
        field_mapping: fieldMapping,
        pipeline_id: pipelineId || null,
        settings,
        status: newStatus as MetaLeadForm["status"],
      });
      toast.success("Formulario salvo com sucesso!");
    } catch (err) {
      console.error("Error saving meta form:", err);
      toast.error("Erro ao salvar formulario.");
    } finally {
      setSaving(false);
    }
  };

  // ── WA variable source options (for templates) ──
  const mappedFields = fieldMapping.filter((m) => m.crm_field);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-[30px] w-[30px] p-0 rounded-[4px]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="h-[30px] text-sm font-semibold border-transparent hover:border-border focus:border-border rounded-[4px] bg-transparent w-64"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="h-[30px] text-xs gap-1.5 rounded-[4px]"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Salvar
        </Button>
      </div>

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-14 border-r border-border shrink-0 flex flex-col items-center py-3 gap-1">
          {SIDEBAR_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.label}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-[4px] transition-colors",
                activeTab === tab.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "mapping" && (
            <MappingSection
              rawQuestions={rawQuestions}
              crmFields={crmFields}
              fieldMapping={fieldMapping}
              getMappingForQuestion={getMappingForQuestion}
              setMappingForQuestion={setMappingForQuestion}
              setOptionsMapping={setOptionsMapping}
              categories={categories}
              allScoreItems={allScoreItems}
            />
          )}

          {activeTab === "pipeline" && (
            <PipelineSection
              pipelines={pipelines}
              pipelineId={pipelineId}
              setPipelineId={setPipelineId}
              pipelineStages={pipelineStages}
              initialStageId={initialStageId}
              setInitialStageId={setInitialStageId}
            />
          )}

          {activeTab === "automations" && (
            <AutomationsSection
              postSubmitActions={postSubmitActions}
              addPostSubmitAction={addPostSubmitAction}
              removePostSubmitAction={removePostSubmitAction}
              patchPostSubmitAction={patchPostSubmitAction}
              channels={channels}
              templates={templates}
              allTemplates={allTemplates}
              mappedFields={mappedFields}
              outboundWebhooks={outboundWebhooks}
              scoreMatrices={scoreMatrices}
            />
          )}

          {activeTab === "success" && (
            <SuccessSection
              successTitle={successTitle}
              setSuccessTitle={setSuccessTitle}
              successMessage={successMessage}
              setSuccessMessage={setSuccessMessage}
              redirectUrl={redirectUrl}
              setRedirectUrl={setRedirectUrl}
              successRoutes={successRoutes}
              addSuccessRoute={addSuccessRoute}
              removeSuccessRoute={removeSuccessRoute}
              patchSuccessRoute={patchSuccessRoute}
              scoreMatrices={scoreMatrices}
              bookingRuleSets={bookingRuleSets}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mapping Section ─────────────────────────────────────────────────────────

function MappingSection({
  rawQuestions,
  crmFields,
  fieldMapping,
  getMappingForQuestion,
  setMappingForQuestion,
  setOptionsMapping,
  categories,
  allScoreItems,
}: {
  rawQuestions: MetaRawQuestion[];
  crmFields: CrmFieldOption[];
  fieldMapping: MetaFieldMapping[];
  getMappingForQuestion: (key: string) => MetaFieldMapping | undefined;
  setMappingForQuestion: (q: MetaRawQuestion, crmField: string) => void;
  setOptionsMapping: (questionKey: string, metaOptionValue: string, scoreItemId: string) => void;
  categories: ScoreCategory[];
  allScoreItems: ScoreCategoryItem[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedFields = useMemo(() => {
    const groups: Record<string, CrmFieldOption[]> = {};
    for (const f of crmFields) {
      if (!groups[f.group]) groups[f.group] = [];
      groups[f.group].push(f);
    }
    return groups;
  }, [crmFields]);

  if (rawQuestions.length === 0) {
    return (
      <div className="text-center py-12">
        <Layers className="w-8 h-8 text-muted-foreground opacity-20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          Nenhuma pergunta encontrada neste formulario.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Sincronize o formulario novamente pelo Facebook.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-foreground">Mapeamento de Campos</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Mapeie cada pergunta do Meta Lead Ads para um campo do CRM.
        </p>
      </div>

      <div className="space-y-2">
        {rawQuestions.map((question) => {
          const mapping = getMappingForQuestion(question.key);
          const crmField = mapping?.crm_field ?? "__none__";
          const isScore = crmField.startsWith("score.");
          const hasOptions = Array.isArray(question.options) && question.options.length > 0;
          const showOptionsMapping = isScore && hasOptions;
          const isExpanded = expanded.has(question.key);

          let categoryId: string | null = null;
          let categoryItems: ScoreCategoryItem[] = [];
          if (isScore) {
            categoryId = getCategoryIdFromCrmField(crmField, categories);
            if (categoryId) {
              categoryItems = allScoreItems.filter(
                (item) => item.category_id === categoryId && item.active
              );
            }
          }

          return (
            <div
              key={question.key}
              className="border border-border rounded-[4px] overflow-hidden"
            >
              <div className="px-3 py-2.5 bg-muted flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {question.label}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] shrink-0",
                        question.type === "PREFILLED"
                          ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      )}
                    >
                      {question.type === "PREFILLED" ? "Prefilled" : "Custom"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {question.key}
                  </p>
                </div>

                <div className="w-52 shrink-0">
                  <Select
                    value={crmField}
                    onValueChange={(v) => setMappingForQuestion(question, v)}
                  >
                    <SelectTrigger className="h-[30px] text-xs rounded-[4px]">
                      <SelectValue placeholder="-- nao mapeado --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="text-xs">
                        <span className="text-muted-foreground">-- nao mapeado --</span>
                      </SelectItem>
                      {Object.entries(groupedFields).map(([group, fields]) => (
                        <React.Fragment key={group}>
                          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            {group}
                          </div>
                          {fields.map((f) => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {showOptionsMapping && (
                <div className="border-t border-border">
                  <button
                    onClick={() => toggleExpand(question.key)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    <span className="font-semibold">Mapear opcoes &rarr; Score</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({(question.options ?? []).length} opcoes)
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {categoryItems.length === 0 && (
                        <p className="text-[10px] text-muted-foreground bg-muted border border-border rounded-[4px] px-2 py-1.5">
                          Nenhum item encontrado para esta categoria de score.
                        </p>
                      )}

                      {(question.options ?? []).map((opt: unknown, idx: number) => {
                        const optObj = opt as Record<string, unknown>;
                        const optValue = String(optObj.value ?? optObj.key ?? idx);
                        const optLabel = String(optObj.value ?? optObj.key ?? `Opcao ${idx + 1}`);
                        const currentScoreItemId =
                          mapping?.options_mapping?.[optValue] ?? "__none__";

                        return (
                          <div key={optValue} className="flex items-center gap-2">
                            <span className="text-xs text-foreground flex-1 truncate min-w-0">
                              {optLabel}
                            </span>
                            <div className="w-44 shrink-0">
                              <Select
                                value={currentScoreItemId}
                                onValueChange={(v) =>
                                  setOptionsMapping(question.key, optValue, v)
                                }
                              >
                                <SelectTrigger className="h-[30px] text-[10px] rounded-[4px]">
                                  <SelectValue placeholder="-- sem item --" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__" className="text-xs">
                                    <span className="text-muted-foreground">-- sem item --</span>
                                  </SelectItem>
                                  {categoryItems.map((item) => (
                                    <SelectItem
                                      key={item.id}
                                      value={item.id}
                                      className="text-xs"
                                    >
                                      {item.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border border-border rounded-[4px] p-3 bg-muted">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">{fieldMapping.length}</span> de{" "}
          <span className="font-semibold text-foreground">{rawQuestions.length}</span> campos
          mapeados.{" "}
          {fieldMapping.length === 0 && (
            <span className="text-amber-500">
              Mapeie pelo menos 1 campo para ativar o formulario.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Pipeline Section ────────────────────────────────────────────────────────

function PipelineSection({
  pipelines,
  pipelineId,
  setPipelineId,
  pipelineStages,
  initialStageId,
  setInitialStageId,
}: {
  pipelines: { id: string; name: string }[];
  pipelineId: string;
  setPipelineId: (id: string) => void;
  pipelineStages: { id: string; name: string; order_index: number }[];
  initialStageId: string;
  setInitialStageId: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-foreground">Pipeline e Etapa</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Defina onde os leads gerados pelo Meta Lead Ads serao inseridos no CRM.
        </p>
      </div>

      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted">
          <label className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wide">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            CRM — Entrada do lead
          </label>
        </div>
        <div className="px-3 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Pipeline de vendas
            </label>
            <Select
              value={pipelineId || "__none__"}
              onValueChange={(v) => {
                const newId = v === "__none__" ? "" : v;
                setPipelineId(newId);
                setInitialStageId("");
              }}
            >
              <SelectTrigger className="h-[30px] text-sm rounded-[4px]">
                <SelectValue placeholder="-- sem pipeline --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- sem pipeline --</SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-sm">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pipelineId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Etapa inicial
              </label>
              <Select
                value={initialStageId || "__first__"}
                onValueChange={(v) =>
                  setInitialStageId(v === "__first__" ? "" : v)
                }
              >
                <SelectTrigger className="h-[30px] text-sm rounded-[4px]">
                  <SelectValue placeholder="Primeira etapa (padrao)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__first__">
                    <span className="text-muted-foreground">Primeira etapa (padrao)</span>
                  </SelectItem>
                  {pipelineStages.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-sm">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Leads criados por este formulario serao inseridos nesta etapa.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Automations Section ─────────────────────────────────────────────────────

function AutomationsSection({
  postSubmitActions,
  addPostSubmitAction,
  removePostSubmitAction,
  patchPostSubmitAction,
  channels,
  templates,
  allTemplates,
  mappedFields,
  outboundWebhooks,
  scoreMatrices,
}: {
  postSubmitActions: MetaPostSubmitAction[];
  addPostSubmitAction: () => void;
  removePostSubmitAction: (id: string) => void;
  patchPostSubmitAction: (id: string, partial: Partial<MetaPostSubmitAction>) => void;
  channels: { id: string; label: string; is_default: boolean }[];
  templates: { id: string; nome: string }[];
  allTemplates: { id: string; nome: string; json_data: { data?: string } | null }[];
  mappedFields: MetaFieldMapping[];
  outboundWebhooks: { id: string; name: string; channel: string }[];
  scoreMatrices: { id: string; score_number: number; name?: string; resolved_categories?: { itemNames: string[] }[] }[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Acoes Pos-Envio</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Envios automaticos apos o lead ser recebido pelo Meta Lead Ads.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={addPostSubmitAction}
          className="h-[30px] text-xs rounded-[4px] gap-1"
        >
          <Plus className="w-3 h-3" />
          Acao
        </Button>
      </div>

      {postSubmitActions.length === 0 && (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-muted-foreground opacity-20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            Nenhuma acao configurada. Clique em "+ Acao" para adicionar.
          </p>
        </div>
      )}

      {postSubmitActions.map((action, idx) => (
        <div
          key={action.id}
          className="border border-border rounded-[4px] bg-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                #{idx + 1}
              </span>
              <div className="flex gap-1">
                {(
                  [
                    { v: "whatsapp" as const, emoji: "💬", label: "WhatsApp" },
                    { v: "email" as const, emoji: "✉️", label: "Email" },
                    { v: "sms" as const, emoji: "📱", label: "SMS" },
                  ] as const
                ).map(({ v, emoji, label }) => (
                  <button
                    key={v}
                    title={label}
                    onClick={() =>
                      patchPostSubmitAction(action.id, {
                        channel: v,
                        wa_channel_id: "",
                        wa_template_id: "",
                        wa_variable_map: {},
                        webhook_id: "",
                        message_template: "",
                      })
                    }
                    className={cn(
                      "flex items-center gap-0.5 px-2 py-0.5 rounded-[4px] border text-[10px] font-semibold transition-colors",
                      action.channel === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {emoji} {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={action.enabled}
                onCheckedChange={(v) =>
                  patchPostSubmitAction(action.id, { enabled: v })
                }
                className="scale-[0.65]"
              />
              <button
                onClick={() => removePostSubmitAction(action.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-3 py-3 space-y-3">
            {/* Delay */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground shrink-0 font-semibold">
                Enviar apos
              </label>
              <Select
                value={String(action.delay_minutes)}
                onValueChange={(v) =>
                  patchPostSubmitAction(action.id, { delay_minutes: Number(v) })
                }
              >
                <SelectTrigger className="h-6 text-[10px] rounded-[4px] flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0" className="text-xs">Imediato</SelectItem>
                  <SelectItem value="5" className="text-xs">5 minutos</SelectItem>
                  <SelectItem value="15" className="text-xs">15 minutos</SelectItem>
                  <SelectItem value="30" className="text-xs">30 minutos</SelectItem>
                  <SelectItem value="60" className="text-xs">1 hora</SelectItem>
                  <SelectItem value="1440" className="text-xs">1 dia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* WhatsApp fields */}
            {action.channel === "whatsapp" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                    Canal WA
                  </label>
                  <Select
                    value={action.wa_channel_id || "__none__"}
                    onValueChange={(v) =>
                      patchPostSubmitAction(action.id, {
                        wa_channel_id: v === "__none__" ? "" : v,
                        wa_template_id: "",
                        wa_variable_map: {},
                      })
                    }
                  >
                    <SelectTrigger className="h-[30px] text-xs rounded-[4px]">
                      <SelectValue placeholder="Selecione canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="text-xs">
                        -- selecione --
                      </SelectItem>
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.label} {c.is_default ? "(padrao)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {action.wa_channel_id && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                      Template aprovado
                    </label>
                    <Select
                      value={action.wa_template_id || "__none__"}
                      onValueChange={(v) =>
                        patchPostSubmitAction(action.id, {
                          wa_template_id: v === "__none__" ? "" : v,
                          wa_variable_map: {},
                        })
                      }
                    >
                      <SelectTrigger className="h-[30px] text-xs rounded-[4px]">
                        <SelectValue placeholder="Selecione template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">
                          -- selecione --
                        </SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Template preview */}
                {action.wa_template_id && (() => {
                  const previewTpl = allTemplates.find((t) => t.id === action.wa_template_id);
                  const previewComponents = getTemplatePreviewComponents(previewTpl as WhatsappTemplate | undefined);
                  if (previewComponents.length === 0) return null;
                  return (
                    <div className="mt-1">
                      <WhatsappTemplatePreview components={previewComponents} />
                    </div>
                  );
                })()}

                {/* Variable mapping for WA template */}
                {action.wa_template_id &&
                  (() => {
                    const tpl = allTemplates.find(
                      (t) => t.id === action.wa_template_id
                    );
                    const bodyText = tpl?.json_data?.data ?? "";
                    const varMatches = [
                      ...new Set(
                        [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])
                      ),
                    ].sort((a, b) => Number(a) - Number(b));
                    if (varMatches.length === 0) return null;

                    return (
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                          Variaveis do template
                        </label>
                        <div className="space-y-1.5">
                          {varMatches.map((varIdx) => {
                            const spec =
                              action.wa_variable_map?.[varIdx] ?? "";
                            const isFixed =
                              spec.startsWith("fixed:") ||
                              (!spec.startsWith("field:") && spec !== "");
                            const fixedVal = spec.startsWith("fixed:")
                              ? spec.slice(6)
                              : !spec.startsWith("field:")
                              ? spec
                              : "";
                            const fieldVal = spec.startsWith("field:")
                              ? spec.slice(6)
                              : "";

                            return (
                              <div key={varIdx} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-[4px] shrink-0">
                                  {`{{${varIdx}}}`}
                                </span>
                                <Select
                                  value={
                                    fieldVal
                                      ? `field:${fieldVal}`
                                      : isFixed
                                      ? "__fixed__"
                                      : "__none__"
                                  }
                                  onValueChange={(v) => {
                                    if (v === "__none__") {
                                      patchPostSubmitAction(action.id, {
                                        wa_variable_map: {
                                          ...action.wa_variable_map,
                                          [varIdx]: "",
                                        },
                                      });
                                    } else if (v === "__fixed__") {
                                      patchPostSubmitAction(action.id, {
                                        wa_variable_map: {
                                          ...action.wa_variable_map,
                                          [varIdx]: "fixed:",
                                        },
                                      });
                                    } else {
                                      patchPostSubmitAction(action.id, {
                                        wa_variable_map: {
                                          ...action.wa_variable_map,
                                          [varIdx]: v,
                                        },
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-6 text-[10px] rounded-[4px] flex-1">
                                    <SelectValue placeholder="-- selecione --" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__" className="text-xs">
                                      -- vazio --
                                    </SelectItem>
                                    <SelectItem
                                      value="field:pessoa.nome"
                                      className="text-xs"
                                    >
                                      Nome
                                    </SelectItem>
                                    <SelectItem
                                      value="field:pessoa.email"
                                      className="text-xs"
                                    >
                                      Email
                                    </SelectItem>
                                    <SelectItem
                                      value="field:pessoa.whatsapp"
                                      className="text-xs"
                                    >
                                      WhatsApp
                                    </SelectItem>
                                    <SelectItem
                                      value="field:empresa.nome"
                                      className="text-xs"
                                    >
                                      Empresa
                                    </SelectItem>
                                    {mappedFields.map((f) => (
                                      <SelectItem
                                        key={f.meta_field}
                                        value={`field:meta.${f.meta_field}`}
                                        className="text-xs"
                                      >
                                        {f.label}
                                      </SelectItem>
                                    ))}
                                    <SelectItem
                                      value="__fixed__"
                                      className="text-xs"
                                    >
                                      Texto fixo...
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {isFixed && (
                                  <input
                                    type="text"
                                    value={fixedVal}
                                    onChange={(e) =>
                                      patchPostSubmitAction(action.id, {
                                        wa_variable_map: {
                                          ...action.wa_variable_map,
                                          [varIdx]: `fixed:${e.target.value}`,
                                        },
                                      })
                                    }
                                    placeholder="Texto fixo"
                                    className="h-6 text-[10px] flex-1 border border-border rounded-[4px] px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
              </>
            )}

            {/* Email / SMS fields */}
            {(action.channel === "email" || action.channel === "sms") && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Webhook de saida</label>
                  {outboundWebhooks.filter((w) => w.channel === action.channel).length > 0 ? (
                    <Select
                      value={action.webhook_id || "__none__"}
                      onValueChange={(v) =>
                        patchPostSubmitAction(action.id, { webhook_id: v === "__none__" ? "" : v })
                      }
                    >
                      <SelectTrigger className="h-[30px] text-xs rounded-[4px]">
                        <SelectValue placeholder="Selecione um webhook" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">-- selecione --</SelectItem>
                        {outboundWebhooks
                          .filter((w) => w.channel === action.channel)
                          .map((w) => (
                            <SelectItem key={w.id} value={w.id} className="text-xs">
                              {w.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-[10px] text-muted-foreground bg-muted border border-border rounded-[4px] px-2 py-1.5">
                      Nenhum webhook {action.channel === "email" ? "de email" : "de SMS"} configurado.{" "}
                      <span className="text-primary">Configuracoes → OMNI PRO → Webhooks.</span>
                    </p>
                  )}
                </div>
                {action.channel === "email" && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Assunto</label>
                    <Input
                      value={action.subject ?? ""}
                      onChange={(e) => patchPostSubmitAction(action.id, { subject: e.target.value })}
                      placeholder="Assunto do e-mail"
                      className="h-[30px] text-xs rounded-[4px]"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Mensagem</label>
                  <textarea
                    value={action.message_template ?? ""}
                    onChange={(e) => patchPostSubmitAction(action.id, { message_template: e.target.value })}
                    placeholder="Use {{pessoa.nome}}, {{pessoa.email}} etc."
                    rows={3}
                    className="w-full text-xs border border-border rounded-[4px] px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </>
            )}

            {/* Score filter */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Filtro por Score</label>
                <Select
                  value={action.score_filter?.mode ?? "all"}
                  onValueChange={(v) => {
                    const mode = v as "all" | "include" | "exclude";
                    patchPostSubmitAction(action.id, {
                      score_filter: mode === "all"
                        ? { mode: "all", matrix_ids: [] }
                        : { mode, matrix_ids: action.score_filter?.matrix_ids ?? [] },
                    });
                  }}
                >
                  <SelectTrigger className="h-6 text-[10px] rounded-[4px] w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todos os scores</SelectItem>
                    <SelectItem value="include" className="text-xs">Somente estes</SelectItem>
                    <SelectItem value="exclude" className="text-xs">Exceto estes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {action.score_filter?.mode && action.score_filter.mode !== "all" && (
                <div className="flex flex-wrap gap-1">
                  {scoreMatrices.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">Nenhuma entrada na matriz score. Configure em Score PRO.</p>
                  ) : scoreMatrices.map((m) => {
                    const selected = action.score_filter?.matrix_ids?.includes(m.id) ?? false;
                    const n = m.score_number;
                    const label = m.name || m.resolved_categories?.map((c) => c.itemNames.join(", ")).join(" · ") || `Score ${n}`;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        title={label}
                        onClick={() => {
                          const current = action.score_filter?.matrix_ids ?? [];
                          const next = selected ? current.filter((id) => id !== m.id) : [...current, m.id];
                          patchPostSubmitAction(action.id, {
                            score_filter: { mode: action.score_filter!.mode, matrix_ids: next },
                          });
                        }}
                        className={cn(
                          "px-2 py-1 rounded-[4px] border text-[10px] font-semibold transition-all max-w-[160px] truncate",
                          selected ? scoreColor(n) : "bg-muted text-muted-foreground border-border opacity-40 hover:opacity-70"
                        )}
                      >
                        <span className="font-bold mr-1">{n}</span>
                        {label.length > 20 ? label.slice(0, 20) + "…" : label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Success Section ────────────────────────────────────────────────────────

function SuccessSection({
  successTitle,
  setSuccessTitle,
  successMessage,
  setSuccessMessage,
  redirectUrl,
  setRedirectUrl,
  successRoutes,
  addSuccessRoute,
  removeSuccessRoute,
  patchSuccessRoute,
  scoreMatrices,
  bookingRuleSets,
}: {
  successTitle: string;
  setSuccessTitle: (v: string) => void;
  successMessage: string;
  setSuccessMessage: (v: string) => void;
  redirectUrl: string;
  setRedirectUrl: (v: string) => void;
  successRoutes: MetaSuccessRoute[];
  addSuccessRoute: () => void;
  removeSuccessRoute: (id: string) => void;
  patchSuccessRoute: (id: string, partial: Partial<MetaSuccessRoute>) => void;
  scoreMatrices: { id: string; score_number: number; name?: string; resolved_categories?: { itemNames: string[] }[] }[];
  bookingRuleSets: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Rotas de Sucesso</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Defina diferentes paginas de sucesso por entrada da matriz score.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-[30px] text-xs gap-1 rounded-[4px]" onClick={addSuccessRoute}>
          <Plus className="w-3 h-3" /> Rota
        </Button>
      </div>

      {/* Default (fallback) */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted">
          <label className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wide">
            <Target className="w-3.5 h-3.5 text-muted-foreground" />
            Padrao (fallback)
          </label>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Usado quando nenhuma rota por score corresponder.
          </p>
        </div>
        <div className="px-3 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Titulo</label>
            <Input
              value={successTitle}
              onChange={(e) => setSuccessTitle(e.target.value)}
              className="h-[30px] text-sm rounded-[4px]"
              placeholder="Enviado com sucesso!"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Mensagem</label>
            <Textarea
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              className="text-sm rounded-[4px] resize-none"
              rows={2}
              placeholder="Obrigado! Entraremos em contato."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Redirecionar (opcional)</label>
            <Input
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://..."
              className="h-[30px] text-sm rounded-[4px]"
            />
          </div>
        </div>
      </div>

      {/* Score-based routes */}
      {successRoutes.map((route) => (
        <div key={route.id} className="border border-border rounded-[4px] overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1.5">Matriz Score</p>
              <div className="flex flex-wrap gap-1">
                {scoreMatrices.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">Nenhuma entrada. Configure em Score PRO.</p>
                ) : scoreMatrices.map((m) => {
                  const selected = route.matrix_ids?.includes(m.id) ?? false;
                  const n = m.score_number;
                  const label = m.name || m.resolved_categories?.map((c) => c.itemNames.join(", ")).join(" · ") || `Score ${n}`;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={label}
                      onClick={() => {
                        const current = route.matrix_ids ?? [];
                        const next = selected ? current.filter((id) => id !== m.id) : [...current, m.id];
                        patchSuccessRoute(route.id, { matrix_ids: next });
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-semibold transition-all border max-w-[140px] truncate",
                        selected ? scoreColor(n) : "bg-muted text-muted-foreground border-border opacity-40 hover:opacity-70"
                      )}
                    >
                      <span className="font-bold mr-0.5">{n}</span>
                      {label.length > 16 ? label.slice(0, 16) + "…" : label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeSuccessRoute(route.id)}
              className="text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-3 space-y-3">
            {/* Action type */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Acao</label>
              <Select
                value={route.action}
                onValueChange={(v) => patchSuccessRoute(route.id, { action: v as MetaSuccessRoute["action"] })}
              >
                <SelectTrigger className="h-[30px] text-xs rounded-[4px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message" className="text-xs">Mensagem personalizada</SelectItem>
                  <SelectItem value="redirect" className="text-xs">Redirecionar para URL</SelectItem>
                  <SelectItem value="booking" className="text-xs">Agendamento inline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message fields */}
            {route.action === "message" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Titulo</label>
                  <Input
                    value={route.title ?? ""}
                    onChange={(e) => patchSuccessRoute(route.id, { title: e.target.value })}
                    placeholder="Parabens! Voce se qualificou."
                    className="h-[30px] text-xs rounded-[4px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Mensagem</label>
                  <textarea
                    value={route.message ?? ""}
                    onChange={(e) => patchSuccessRoute(route.id, { message: e.target.value })}
                    placeholder="Entraremos em contato em breve..."
                    rows={2}
                    className="w-full text-xs border border-border rounded-[4px] px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </>
            )}

            {/* Redirect fields */}
            {route.action === "redirect" && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">URL de redirecionamento</label>
                <Input
                  value={route.redirect_url ?? ""}
                  onChange={(e) => patchSuccessRoute(route.id, { redirect_url: e.target.value })}
                  placeholder="https://..."
                  className="h-[30px] text-xs rounded-[4px]"
                />
              </div>
            )}

            {/* Booking fields */}
            {route.action === "booking" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Regra de agendamento
                  </label>
                  {bookingRuleSets.length > 0 ? (
                    <Select
                      value={route.booking_rule_set_id || "__none__"}
                      onValueChange={(v) =>
                        patchSuccessRoute(route.id, { booking_rule_set_id: v === "__none__" ? undefined : v })
                      }
                    >
                      <SelectTrigger className="h-[30px] text-xs rounded-[4px]">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">-- selecione --</SelectItem>
                        {bookingRuleSets.map((rs) => (
                          <SelectItem key={rs.id} value={rs.id} className="text-xs">
                            {rs.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-[10px] text-muted-foreground bg-muted border border-border rounded-[4px] px-2 py-1.5">
                      Nenhuma regra configurada. Acesse Schedule PRO para criar.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Titulo (opcional)</label>
                  <Input
                    value={route.title ?? ""}
                    onChange={(e) => patchSuccessRoute(route.id, { title: e.target.value })}
                    placeholder="Agende sua conversa!"
                    className="h-[30px] text-xs rounded-[4px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Mensagem (opcional)</label>
                  <textarea
                    value={route.message ?? ""}
                    onChange={(e) => patchSuccessRoute(route.id, { message: e.target.value })}
                    placeholder="Escolha o melhor horario para conversarmos."
                    rows={2}
                    className="w-full text-xs border border-border rounded-[4px] px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> WhatsApp pos-booking
                  </label>
                  <Input
                    value={route.wa_confirm_template ?? ""}
                    onChange={(e) => patchSuccessRoute(route.id, { wa_confirm_template: e.target.value || undefined })}
                    placeholder="confirmacao_reuniao"
                    className="h-[30px] text-xs rounded-[4px]"
                  />
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    Nome do template Meta para enviar apos o agendamento. Variaveis: {"{{1}}"} nome, {"{{2}}"} data, {"{{3}}"} hora, {"{{4}}"} link Meet.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      {successRoutes.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">Nenhuma rota por score configurada.</p>
          <p className="text-[10px] mt-1">O padrao acima sera usado para todos os envios.</p>
        </div>
      )}
    </div>
  );
}

export default MetaFormEditor;
