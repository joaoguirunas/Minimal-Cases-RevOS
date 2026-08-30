import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Save,
  ArrowLeft,
  Loader2,
  ClipboardList,
  Settings2,
  Paintbrush,
  EyeOff,

  Copy,
  Check,
  BotMessageSquare,
  AlignLeft,
  RotateCcw,
  BookOpen,
  Plus,
  ExternalLink,
  LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { usePipelines } from "@/hooks/usePipelines";
import {
  useCreateLpForm,
  useUpdateLpForm,
} from "@/hooks/useLpForms";
import type {
  LpForm,
  LpFormField,
  LpFormSettings,
} from "@/hooks/useLpForms";
import { useLpFormCatalog } from "@/hooks/useLpFormCatalog";
import type { CatalogField } from "@/hooks/useLpFormCatalog";
import { LpFieldEditor } from "./LpFieldEditor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Extracted sub-components ─────────────────────────────────────────────────
import { DEFAULT_SETTINGS, TEMPLATES } from "./formBuilderConstants";
import { CatalogSidebar } from "./FormBuilderCatalog";

import { SettingsPanel } from "./FormBuilderSettings";
import { StylePanel, StyleFormPreview } from "./FormBuilderStyle";
import { SortableStepItem, SortableFieldItem } from "./FormBuilderSortable";

// ─── Main component ────────────────────────────────────────────────────────────

interface LpFormBuilderProps {
  form?: LpForm | null;
  onBack: () => void;
}

type BuilderTab = "campos" | "estilo" | "config";

export function LpFormBuilder({ form, onBack }: LpFormBuilderProps) {
  const { t } = useTranslation();
  const { pipelines = [], stages = [] } = usePipelines();
  const createForm = useCreateLpForm();
  const updateForm = useUpdateLpForm();
  const { groups: catalogGroups, isLoading: catalogLoading } =
    useLpFormCatalog();

  const [name, setName] = useState(form?.name ?? "");
  const [pipelineId, setPipelineId] = useState<string>(
    form?.pipeline_id ?? ""
  );
  const [fields, setFields] = useState<LpFormField[]>(
    form?.fields ?? []
  );
  const [settings, setSettings] = useState<LpFormSettings>(
    form?.settings ?? DEFAULT_SETTINGS
  );
  const [activeTab, setActiveTab] = useState<BuilderTab>("campos");
  const [savedFormId, setSavedFormId] = useState<string | undefined>(form?.id);

  // ── Undo history ────────────────────────────────────────────────────────────
  type HistorySnap = { fields: LpFormField[]; settings: LpFormSettings };
  const [history, setHistory] = useState<HistorySnap[]>([]);
  const fieldsRef = useRef<LpFormField[]>(fields);
  const settingsRef = useRef<LpFormSettings>(settings);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const canUndo = history.length > 0;

  function pushHistory() {
    setHistory(h => [...h.slice(-19), { fields: fieldsRef.current, settings: settingsRef.current }]);
  }

  function handleUndo() {
    if (history.length === 0) return;
    const snap = history[history.length - 1];
    setFields(snap.fields);
    setSettings(snap.settings);
    setHistory(h => h.slice(0, -1));
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const handleUndoRef = useRef<() => void>(() => {});
  useEffect(() => { handleUndoRef.current = handleUndo; });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Auto-sync score field options with Score PRO catalog ───────────────────
  // Heals stale/corrupted options: replaces saved options with live DB values.
  useEffect(() => {
    if (catalogLoading || catalogGroups.length === 0) return;
    const scoreGroup = catalogGroups.find((g) => g.id === "score");
    if (!scoreGroup) return;
    const catalogMap = new Map(scoreGroup.fields.map((f) => [f.crm_field, f.options ?? []]));
    setFields((prev) => {
      let changed = false;
      const next = prev.map((f) => {
        if (!f.crm_field?.startsWith("score.")) return f;
        const catalogOpts = catalogMap.get(f.crm_field);
        if (!catalogOpts) return f;
        // Compare: if options differ (length or any value mismatch), replace
        const cur = f.options ?? [];
        if (cur.length === catalogOpts.length && cur.every((o, i) => o.value === catalogOpts[i].value && o.label === catalogOpts[i].label)) return f;
        changed = true;
        return { ...f, options: catalogOpts };
      });
      return changed ? next : prev;
    });
  }, [catalogGroups, catalogLoading]);

  const isSaving = createForm.isPending || updateForm.isPending;
  const formMode = settings.mode ?? "classic";
  const isChatbot = formMode === "chatbot";
  const isSteps = formMode === "steps";

  const alreadyAdded = useMemo(
    () =>
      new Set(
        fields.map((f) => f.crm_field).filter(Boolean) as string[]
      ),
    [fields]
  );

  const addFromCatalog = useCallback((cf: CatalogField) => {
    pushHistory();
    setFields((prev) => {
      const firstStepId = settings.steps?.[0]?.id;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: cf.type,
          label: cf.label,
          placeholder: cf.placeholder ?? "",
          required: false,
          crm_field: cf.crm_field,
          options: cf.options ? [...cf.options] : undefined,
          conditions: [],
          order: prev.length,
          step_id: formMode === "steps" && firstStepId ? firstStepId : undefined,
        },
      ];
    });
  }, [formMode, settings.steps]);

  const addFromCatalogAll = useCallback((catalogFields: CatalogField[]) => {
    pushHistory();
    setFields((prev) => {
      const firstStepId = settings.steps?.[0]?.id;
      return [
        ...prev,
        ...catalogFields.map((cf, i) => ({
          id: crypto.randomUUID(),
          type: cf.type,
          label: cf.label,
          placeholder: cf.placeholder ?? "",
          required: false,
          crm_field: cf.crm_field,
          options: cf.options ? [...cf.options] : undefined,
          conditions: [],
          order: prev.length + i,
          step_id: formMode === "steps" && firstStepId ? firstStepId : undefined,
        })),
      ];
    });
  }, [formMode, settings.steps]);

  const addHiddenField = useCallback(() => {
    pushHistory();
    setFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "hidden",
        label: "Campo oculto",
        placeholder: "",
        required: false,
        crm_field: undefined,
        conditions: [],
        order: prev.length,
      },
    ]);
  }, []);

  const updateField = useCallback((idx: number, updated: LpFormField) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? updated : f)));
  }, []);

  const deleteField = useCallback((idx: number) => {
    pushHistory();
    setFields((prev) =>
      prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i }))
    );
  }, []);

  const moveField = useCallback((idx: number, dir: -1 | 1) => {
    pushHistory();
    setFields((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      // Prevent visible field from crossing into hidden zone and vice-versa
      if (dir === 1 && next[idx].type !== "hidden" && next[target].type === "hidden") return prev;
      if (dir === -1 && next[idx].type === "hidden" && next[target].type !== "hidden") return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  // ── Mode switch ──────────────────────────────────────────────────────────────
  function handleModeChange(mode: "classic" | "steps" | "chatbot") {
    pushHistory();
    setSettings((s) => {
      const next: LpFormSettings = { ...s, mode };
      if (mode === "steps" && (!s.steps || s.steps.length === 0)) {
        next.steps = [{ id: crypto.randomUUID(), title: "Passo 1", order: 0 }];
      }
      return next;
    });
  }

  // ── Step management ──────────────────────────────────────────────────────────
  function addStep() {
    setSettings((s) => {
      const steps = s.steps ?? [];
      return {
        ...s,
        steps: [...steps, { id: crypto.randomUUID(), title: `Passo ${steps.length + 1}`, order: steps.length }],
      };
    });
  }

  function removeStep(stepId: string) {
    pushHistory();
    setSettings((s) => ({
      ...s,
      steps: (s.steps ?? []).filter((st) => st.id !== stepId).map((st, i) => ({ ...st, order: i })),
    }));
    // unassign fields from removed step
    setFields((prev) => prev.map((f) => f.step_id === stepId ? { ...f, step_id: undefined } : f));
  }

  function renameStep(stepId: string, title: string) {
    setSettings((s) => ({
      ...s,
      steps: (s.steps ?? []).map((st) => st.id === stepId ? { ...st, title } : st),
    }));
  }

  function moveStep(stepId: string, dir: -1 | 1) {
    setSettings((s) => {
      const steps = [...(s.steps ?? [])];
      const idx = steps.findIndex((st) => st.id === stepId);
      const target = idx + dir;
      if (target < 0 || target >= steps.length) return s;
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...s, steps: steps.map((st, i) => ({ ...st, order: i })) };
    });
  }

  const [savedOk, setSavedOk] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome do formulário");
      return;
    }
    const payload = {
      name: name.trim(),
      pipeline_id: pipelineId || null,
      fields,
      settings,
    };
    try {
      const existingId = savedFormId ?? form?.id;
      if (existingId) {
        await updateForm.mutateAsync({ id: existingId, ...payload });
        setSavedFormId(existingId);
      } else {
        const created = await createForm.mutateAsync(payload);
        setSavedFormId(created.id);
      }
      toast.success("Formulário salvo!");
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch {
      toast.error("Erro ao salvar formulário");
    }
  }

  const visibleCount = fields.filter((f) => f.type !== "hidden").length;
  const requiredCount = fields.filter((f) => f.required).length;
  const unmappedCount = fields.filter(
    (f) => f.type !== "hidden" && !f.crm_field
  ).length;

  const builderTabs: { key: BuilderTab; label: string; icon: React.ReactNode }[] = [
    { key: "campos", label: "Edição de Campos", icon: <LayoutList className="w-3.5 h-3.5" /> },
    { key: "estilo", label: "Estilo",            icon: <Paintbrush className="w-3.5 h-3.5" /> },
    { key: "config", label: "Config",            icon: <Settings2 className="w-3.5 h-3.5" /> },
  ];

  // ── Steps canvas ─────────────────────────────────────────────────────────────
  const stepsForCanvas = settings.steps ?? [];
  const hiddenFields = fields.filter((f) => f.type === "hidden");
  const visibleFields = fields.filter((f) => f.type !== "hidden");
  const unassignedVisible = fields.filter(
    (f) => f.type !== "hidden" && (!f.step_id || !stepsForCanvas.find((s) => s.id === f.step_id))
  );

  function globalIdx(f: LpFormField) {
    return fields.findIndex((x) => x.id === f.id);
  }

  // ── Step 1 warning: must have name + (phone or email) ────────────────────────
  const firstStep = stepsForCanvas[0];
  const firstStepFields = firstStep ? fields.filter((f) => f.step_id === firstStep.id) : [];
  const firstStepCrmFields = firstStepFields.map((f) => f.crm_field ?? '');
  const hasName = firstStepCrmFields.some((c) => c === 'pessoa.nome');
  const hasPhone = firstStepCrmFields.some((c) => c === 'pessoa.whatsapp');
  const hasEmail = firstStepCrmFields.some((c) => c === 'pessoa.email');
  const firstStepWarning = isSteps && stepsForCanvas.length > 0 && !(hasName && (hasPhone || hasEmail));

  // ── Unified DnD handler for steps mode ───────────────────────────────────────
  // Handles both step reorder (drag handle on step header) and field drag
  // (within a step or between steps). Distinguishes via active.data.current.type.
  function handleStepsModeEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { type?: string; stepId?: string } | undefined;
    const overData = over.data.current as { type?: string; stepId?: string } | undefined;
    const activeType = activeData?.type;

    // ── Step reorder ──────────────────────────────────────────────────────────
    if (activeType === "step") {
      if (active.id === over.id) return;
      pushHistory();
      setSettings((s) => {
        const steps = [...(s.steps ?? [])];
        const oldIdx = steps.findIndex((st) => st.id === active.id);
        const newIdx = steps.findIndex((st) => st.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return s;
        const reordered = arrayMove(steps, oldIdx, newIdx);
        return { ...s, steps: reordered.map((st, i) => ({ ...st, order: i })) };
      });
      return;
    }

    // ── Field drag (within step or between steps) ─────────────────────────────
    if (activeType === "field") {
      const fromStepId = activeData?.stepId;

      // Resolve target step from the over item's data
      let toStepId: string | undefined;
      if (overData?.type === "field") {
        toStepId = overData.stepId;
      } else if (overData?.type === "step-container") {
        toStepId = overData.stepId;
      } else if (overData?.type === "step") {
        // Dropped onto a step header area — assign to that step
        toStepId = over.id as string;
      }

      if (!fromStepId || !toStepId) return;

      if (fromStepId === toStepId) {
        // Reorder within the same step
        if (active.id === over.id) return;
        pushHistory();
        setFields((prev) => {
          const stepFields = prev.filter((f) => f.step_id === fromStepId);
          const otherFields = prev.filter((f) => f.step_id !== fromStepId);
          const oldIdx = stepFields.findIndex((f) => f.id === active.id);
          const newIdx = stepFields.findIndex((f) => f.id === over.id);
          if (oldIdx === -1 || newIdx === -1) return prev;
          const reordered = arrayMove(stepFields, oldIdx, newIdx);
          return [...reordered, ...otherFields].map((f, i) => ({ ...f, order: i }));
        });
      } else {
        // Move field to a different step
        pushHistory();
        setFields((prev) =>
          prev.map((f) => (f.id === active.id ? { ...f, step_id: toStepId } : f))
        );
      }
    }
  }

  // ── DnD (classic/chatbot canvas) ─────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    pushHistory();
    setFields((prev) => {
      const vis = prev.filter((f) => f.type !== "hidden");
      const hid = prev.filter((f) => f.type === "hidden");
      const oldIdx = vis.findIndex((f) => f.id === active.id);
      const newIdx = vis.findIndex((f) => f.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(vis, oldIdx, newIdx);
      return [...reordered, ...hid].map((f, i) => ({ ...f, order: i }));
    });
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </button>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do formulário"
          className="h-[30px] text-sm font-medium rounded-[4px] flex-1 max-w-xs"
        />

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-1 shrink-0">
          <span>{visibleCount} campo{visibleCount !== 1 ? "s" : ""}</span>
          {requiredCount > 0 && (
            <span className="text-primary font-semibold">
              {requiredCount} obrigatório{requiredCount > 1 ? "s" : ""}
            </span>
          )}
          {unmappedCount > 0 && (
            <span className="text-yellow-500 font-semibold">
              {unmappedCount} sem mapeamento
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {canUndo && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUndo}
              title="Desfazer (Ctrl+Z)"
              className="h-[30px] gap-1.5 text-muted-foreground rounded-[4px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-xs">{history.length}</span>
            </Button>
          )}

          {savedFormId && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/f/${savedFormId}`); toast.success("URL copiada!"); }}
                title="Copiar URL do formulário"
                className="h-[30px] gap-1.5 text-muted-foreground rounded-[4px] text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar URL
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-[30px] gap-1.5 rounded-[4px] text-xs"
              >
                <a href={`${window.location.origin}/f/${savedFormId}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir form
                </a>
              </Button>
            </>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className={cn("h-[30px] gap-2 shrink-0 transition-colors rounded-[4px] text-xs", savedOk && "border-green-500/60 text-green-600")}
            variant={savedOk ? "outline" : "default"}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedOk ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {savedOk ? "Salvo!" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* ── Top-level tab bar ── */}
      <div className="flex items-center border-b border-border mb-0 shrink-0">
        {builderTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content area ── */}
      <div className="flex flex-1 min-h-0 rounded-b-[4px] border border-t-0 border-border overflow-hidden">

        {/* ══════════════════════════════════════════════════════════════════════
           TAB: Edição de Campos — Catalog + Canvas
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "campos" && (
          <>
            {/* Left: Catalog */}
            <div className="w-[240px] shrink-0 flex flex-col border-r border-border bg-card">
              <CatalogSidebar
                catalogGroups={catalogGroups}
                alreadyAdded={alreadyAdded}
                onPick={addFromCatalog}
                onPickAll={addFromCatalogAll}
                onAddHidden={addHiddenField}
                isLoading={catalogLoading}
              />
            </div>

            {/* Center: Canvas */}
            <div className="flex-1 min-w-0 flex flex-col bg-background">
              {/* Mode selector */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0 bg-card">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                  Modo
                </span>
                <div className="flex items-center gap-0.5 bg-muted rounded-[4px] p-0.5">
                  {(
                    [
                      { key: "classic" as const, icon: <AlignLeft className="w-3.5 h-3.5" />, label: "Padrão" },
                      { key: "steps"   as const, icon: <BookOpen className="w-3.5 h-3.5" />,  label: "Etapas" },
                      { key: "chatbot" as const, icon: <BotMessageSquare className="w-3.5 h-3.5" />, label: "Chatbot" },
                    ] as const
                  ).map(({ key, icon, label }) => (
                    <button
                      key={key}
                      onClick={() => handleModeChange(key)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[3px] transition-all",
                        formMode === key
                          ? "bg-card text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
                {isChatbot && (
                  <span className="text-[10px] text-muted-foreground/60 italic">
                    Configure a &quot;Pergunta&quot; em cada campo
                  </span>
                )}
                {isSteps && stepsForCanvas.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60 italic">
                    {stepsForCanvas.length} passo{stepsForCanvas.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Canvas content */}
              <div className="flex-1 overflow-y-auto">
                {isSteps ? (
                  <div className="p-4 space-y-3">
                    {fields.length === 0 && stepsForCanvas.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-40 gap-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          Clique em campos no catálogo para adicionar ao primeiro passo
                        </p>
                      </div>
                    )}

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStepsModeEnd}>
                      <SortableContext items={stepsForCanvas.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {stepsForCanvas.map((step, stepI) => (
                            <SortableStepItem
                              key={step.id}
                              step={step}
                              stepI={stepI}
                              totalSteps={stepsForCanvas.length}
                              fields={fields}
                              catalogGroups={catalogGroups}
                              stepsForCanvas={stepsForCanvas}
                              globalIdx={globalIdx}
                              renameStep={renameStep}
                              removeStep={removeStep}
                              updateField={updateField}
                              deleteField={deleteField}
                              moveField={moveField}
                              firstStepWarning={firstStepWarning}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>

                    <button
                      onClick={addStep}
                      className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-border rounded-[4px] text-xs text-muted-foreground/60 hover:text-foreground hover:border-primary/50 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar passo
                    </button>

                    {unassignedVisible.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-medium text-yellow-500/80 uppercase tracking-wide px-2 py-1.5">
                          ⚠ Sem passo atribuído ({unassignedVisible.length})
                        </p>
                        {unassignedVisible.map((field) => {
                          const idx = globalIdx(field);
                          return (
                            <LpFieldEditor
                              key={field.id}
                              field={field}
                              allFields={fields}
                              catalogGroups={catalogGroups}
                              formMode="steps"
                              steps={stepsForCanvas}
                              onUpdate={(updated) => updateField(idx, updated)}
                              onDelete={() => deleteField(idx)}
                              onMoveUp={() => moveField(idx, -1)}
                              onMoveDown={() => moveField(idx, 1)}
                              isFirst={idx === 0}
                              isLast={idx === fields.length - 1}
                            />
                          );
                        })}
                      </div>
                    )}

                    {hiddenFields.length > 0 && (
                      <div className="space-y-0.5 pt-2">
                        <div className="flex items-center gap-1.5 px-2 py-1.5">
                          <EyeOff className="w-3 h-3 text-muted-foreground/40" />
                          <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">
                            Campos ocultos ({hiddenFields.length})
                          </span>
                        </div>
                        {hiddenFields.map((field) => {
                          const idx = globalIdx(field);
                          return (
                            <LpFieldEditor
                              key={field.id}
                              field={field}
                              allFields={fields}
                              catalogGroups={catalogGroups}
                              formMode="steps"
                              steps={stepsForCanvas}
                              onUpdate={(updated) => updateField(idx, updated)}
                              onDelete={() => deleteField(idx)}
                              onMoveUp={() => moveField(idx, -1)}
                              onMoveDown={() => moveField(idx, 1)}
                              isFirst={idx === 0}
                              isLast={idx === fields.length - 1}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4">
                    {fields.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-6 text-center pt-12">
                        <div>
                          <div className="w-12 h-12 rounded-[2px] bg-muted flex items-center justify-center mx-auto mb-3">
                            <ClipboardList className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">Nenhum campo ainda</p>
                          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                            Clique em qualquer campo no catálogo à esquerda para adicioná-lo
                          </p>
                        </div>
                        <div className="w-full max-w-[280px]">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2.5 font-semibold">
                            Modelos rápidos
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {TEMPLATES.map((tmpl) => (
                              <button
                                key={tmpl.label}
                                onClick={() => setFields(tmpl.fields())}
                                className="text-xs border border-border rounded-[4px] px-3 py-2.5 text-muted-foreground hover:border-primary hover:text-foreground hover:bg-primary/5 transition-all text-left font-medium"
                              >
                                {tmpl.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <div className="space-y-0.5">
                          <SortableContext items={visibleFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                            {visibleFields.map((field) => {
                              const idx = globalIdx(field);
                              const lastVisIdx = visibleFields.length - 1;
                              const visIdx = visibleFields.indexOf(field);
                              return (
                                <SortableFieldItem
                                  key={field.id}
                                  id={field.id}
                                  field={field}
                                  allFields={fields}
                                  catalogGroups={catalogGroups}
                                  formMode={formMode}
                                  steps={stepsForCanvas}
                                  onUpdate={(updated) => updateField(idx, updated)}
                                  onDelete={() => deleteField(idx)}
                                  onMoveUp={() => moveField(idx, -1)}
                                  onMoveDown={() => moveField(idx, 1)}
                                  isFirst={visIdx === 0}
                                  isLast={visIdx === lastVisIdx}
                                />
                              );
                            })}
                          </SortableContext>

                          {hiddenFields.length > 0 && (
                            <div className="pt-3 space-y-0.5">
                              <div className="flex items-center gap-1.5 px-2 py-1">
                                <EyeOff className="w-3 h-3 text-muted-foreground/40" />
                                <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide">
                                  Campos ocultos ({hiddenFields.length})
                                </span>
                              </div>
                              {hiddenFields.map((field) => {
                                const idx = globalIdx(field);
                                return (
                                  <LpFieldEditor
                                    key={field.id}
                                    field={field}
                                    allFields={fields}
                                    catalogGroups={catalogGroups}
                                    formMode={formMode}
                                    steps={stepsForCanvas}
                                    onUpdate={(updated) => updateField(idx, updated)}
                                    onDelete={() => deleteField(idx)}
                                    onMoveUp={() => moveField(idx, -1)}
                                    onMoveDown={() => moveField(idx, 1)}
                                    isFirst={false}
                                    isLast={true}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </DndContext>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
           TAB: Estilo — Style controls (left) + Live preview (right)
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "estilo" && (
          <>
            <div className="w-[420px] shrink-0 flex flex-col border-r border-border bg-card">
              <StylePanel fields={fields} settings={settings} setSettings={setSettings} hidePreview />
            </div>
            <div className="flex-1 min-w-0 flex flex-col bg-muted">
              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
                <span className="text-[10px] text-muted-foreground ml-1 font-semibold">Preview ao vivo</span>
              </div>
              <div className="flex-1 overflow-y-auto flex items-start justify-center p-6">
                <div className="w-full max-w-md">
                  <StyleFormPreview fields={fields} settings={settings} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
           TAB: Config — full width
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "config" && (
          <div className="flex-1 overflow-hidden flex flex-col bg-card">
            <SettingsPanel
              settings={settings}
              setSettings={setSettings}
              pipelineId={pipelineId}
              setPipelineId={setPipelineId}
              pipelines={pipelines}
              stages={stages}
              fields={fields}
              formId={savedFormId}
            />
          </div>
        )}

      </div>
    </div>
  );
}
