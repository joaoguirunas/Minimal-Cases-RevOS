import { useState, useMemo, useCallback } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, AlertTriangle,
  Loader2, FileText, Link2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLpFormCatalog, type CatalogField, type CatalogGroup } from "@/hooks/useLpFormCatalog";
import { useMetaConnectedPages } from "@/hooks/useMetaLeadForms";
import { usePipelines } from "@/hooks/usePipelines";
import {
  mapCrmFieldsToMeta,
  MAX_CUSTOM_QUESTIONS,
  CRM_TO_META_MAP,
  type SelectedCrmField,
  type MappingResult,
} from "@/lib/meta-field-mapping";

// ── Types ──────────────────────────────────────────────────────

interface MetaFormBuilderProps {
  onBack: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Nome & Page",
  2: "Campos",
  3: "Mapeamento",
  4: "Confirmação",
  5: "Pipeline",
};

// ── Component ──────────────────────────────────────────────────

export function MetaFormBuilder({ onBack }: MetaFormBuilderProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [creating, setCreating] = useState(false);

  // Step 1: Name & Page
  const [formName, setFormName] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");

  // Step 2: Fields
  const [selectedFields, setSelectedFields] = useState<SelectedCrmField[]>([]);

  // Step 3: Mapping (auto-generated, viewable)
  const mapping = useMemo<MappingResult>(
    () => mapCrmFieldsToMeta(selectedFields),
    [selectedFields]
  );

  // Step 4: Thank-you & Privacy
  const [thankYouTitle, setThankYouTitle] = useState("Obrigado!");
  const [thankYouBody, setThankYouBody] = useState("Entraremos em contato em breve.");
  const [privacyUrl, setPrivacyUrl] = useState("");

  // Step 5: Pipeline
  const [pipelineId, setPipelineId] = useState("");

  // Data hooks
  const { groups, isLoading: catalogLoading } = useLpFormCatalog();
  const { data: pages = [] } = useMetaConnectedPages();
  const { pipelines = [] } = usePipelines();

  // Filter out UTM and hidden-only groups for Meta forms
  const filteredGroups = useMemo(
    () => groups.filter((g) => g.id !== "utm"),
    [groups]
  );

  // ── Field selection ────────────────────────────────────────────

  const toggleField = useCallback((field: CatalogField) => {
    setSelectedFields((prev) => {
      const exists = prev.find((f) => f.crm_field === field.crm_field);
      if (exists) return prev.filter((f) => f.crm_field !== field.crm_field);
      return [...prev, {
        crm_field: field.crm_field,
        label: field.label,
        type: field.type,
        options: field.options?.map((o) => ({ value: o.value, label: o.label })),
      }];
    });
  }, []);

  const isFieldSelected = useCallback(
    (crm_field: string) => selectedFields.some((f) => f.crm_field === crm_field),
    [selectedFields]
  );

  // ── Navigation ─────────────────────────────────────────────────

  const canNext = (): boolean => {
    switch (step) {
      case 1: return formName.trim().length > 0 && selectedPageId.length > 0;
      case 2: return selectedFields.length > 0;
      case 3: return !mapping.exceeds_limit;
      case 4: return privacyUrl.trim().length > 0;
      case 5: return true;
      default: return false;
    }
  };

  // ── Submit ─────────────────────────────────────────────────────

  async function handleCreate() {
    setCreating(true);
    try {
      const { prefilled, custom_questions } = mapping;
      const questions = [
        ...prefilled,
        ...custom_questions,
      ];

      const { data, error } = await supabase.functions.invoke("meta-leadgen-create", {
        body: {
          page_id: selectedPageId,
          name: formName,
          questions,
          thank_you_page: { title: thankYouTitle, body: thankYouBody },
          privacy_policy_url: privacyUrl,
          field_mapping: mapping.field_mapping,
          settings: {},
          pipeline_id: pipelineId || null,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success(`Formulário "${formName}" criado com sucesso!`);
      onBack();
    } catch (err) {
      toast.error(`Erro ao criar formulário: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-[30px] px-2 rounded-[4px]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1877F2]/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-[#1877F2]" />
            </div>
            <span className="text-sm font-semibold">Novo Formulário Meta</span>
          </div>
          <div className="flex-1" />
          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                  s < step ? "bg-green-500 text-white" :
                  s === step ? "bg-[#1877F2] text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {s < step ? <Check className="w-3 h-3" /> : s}
                </div>
                {s < 5 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-semibold">{STEP_LABELS[step]}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 1 && "Defina o nome e selecione a Facebook Page."}
              {step === 2 && "Selecione os campos CRM que o formulário deve capturar."}
              {step === 3 && "Verifique o mapeamento automático dos campos."}
              {step === 4 && "Configure a tela de agradecimento e política de privacidade."}
              {step === 5 && "Vincule a um pipeline para criação automática de leads."}
            </p>
          </div>

          {/* ── Step 1: Name & Page ──────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Nome do formulário</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Captação Instagram Lead Ads"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Facebook Page</Label>
                {pages.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Nenhuma Page conectada. Conecte uma Page em Configurações → Ads.
                  </p>
                ) : (
                  <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecionar Page..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((p) => (
                        <SelectItem key={p.page_id} value={p.page_id}>
                          {p.page_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Field Selection ─────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                filteredGroups.map((group: CatalogGroup) => (
                  <div key={group.id} className="border border-border rounded-[2px] overflow-hidden">
                    <div className="px-3 py-2 bg-muted border-b border-border">
                      <span className="text-xs font-medium">{group.icon} {group.label}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {group.fields.map((field: CatalogField) => {
                        const selected = isFieldSelected(field.crm_field);
                        const hasMeta = field.crm_field in CRM_TO_META_MAP;
                        return (
                          <button
                            key={field.crm_field}
                            onClick={() => toggleField(field)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
                              selected ? "bg-primary/5" : "hover:bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                selected ? "bg-primary border-primary" : "border-border"
                              )}>
                                {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </div>
                              <span className="text-sm truncate">{field.label}</span>
                            </div>
                            {hasMeta && (
                              <span className="text-[9px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-[2px] shrink-0">
                                Prefilled
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              <p className="text-[10px] text-muted-foreground">
                {selectedFields.length} campo(s) selecionado(s) · Campos marcados "Prefilled" são preenchidos automaticamente pelo Facebook
              </p>
            </div>
          )}

          {/* ── Step 3: Mapping Preview ─────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              {mapping.exceeds_limit && (
                <div className="flex items-start gap-2 p-3 rounded-[2px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Limite de custom questions excedido
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                      {mapping.custom_count}/{MAX_CUSTOM_QUESTIONS} custom questions. Remova {mapping.custom_count - MAX_CUSTOM_QUESTIONS} campo(s) no step anterior.
                    </p>
                  </div>
                </div>
              )}

              <div className="border border-border rounded-[2px] overflow-hidden">
                <div className="px-3 py-2 bg-muted border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium">Mapeamento CRM → Meta</span>
                  <span className="text-[10px] text-muted-foreground">
                    {mapping.prefilled.length} prefilled · {mapping.custom_count} custom
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {mapping.field_mapping.map((m) => (
                    <div key={m.crm_field} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">{m.crm_field}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-xs font-medium">{m.meta_field}</span>
                      </div>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-[2px]",
                        m.meta_type === 'prefilled'
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      )}>
                        {m.meta_type === 'prefilled' ? 'Prefilled' : 'Custom'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Thank-you & Privacy ──────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="border border-border rounded-[2px] p-4 space-y-3">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Tela de agradecimento
                </p>
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input
                    value={thankYouTitle}
                    onChange={(e) => setThankYouTitle(e.target.value)}
                    placeholder="Obrigado!"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Mensagem</Label>
                  <Input
                    value={thankYouBody}
                    onChange={(e) => setThankYouBody(e.target.value)}
                    placeholder="Entraremos em contato em breve."
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="border border-border rounded-[2px] p-4 space-y-3">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Política de privacidade
                  <span className="text-[9px] text-red-500">*obrigatório</span>
                </p>
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={privacyUrl}
                    onChange={(e) => setPrivacyUrl(e.target.value)}
                    placeholder="https://seusite.com/privacidade"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Pipeline ─────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Pipeline (opcional)</Label>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Leads recebidos serão criados automaticamente no pipeline selecionado.
                </p>
                <Select value={pipelineId || "__none__"} onValueChange={(v) => setPipelineId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum pipeline</SelectItem>
                    {pipelines.map((p: { id: string; name: string }) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none border-t border-border bg-background px-6 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => step === 1 ? onBack() : setStep((step - 1) as WizardStep)}
            className="h-[30px] px-3 text-xs gap-1 rounded-[4px]"
          >
            <ArrowLeft className="w-3 h-3" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>

          {step < 5 ? (
            <Button
              size="sm"
              onClick={() => setStep((step + 1) as WizardStep)}
              disabled={!canNext()}
              className="h-[30px] px-3 text-xs gap-1 rounded-[4px]"
            >
              Próximo
              <ArrowRight className="w-3 h-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating}
              className="h-[30px] px-4 text-xs gap-1.5 rounded-[4px] bg-[#1877F2] hover:bg-[#166FE5]"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {creating ? "Criando..." : "Criar Formulário"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
