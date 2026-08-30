import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  Trash2,
  ExternalLink,
  Pencil,
  Clock,
  CheckCircle2,
  Send,
  CheckCircle,
  XCircle,
  User,
  RefreshCw,
  Copy,
  BarChart2,
  Layers,
  MessageSquare,
  Bot,
  PanelRight,
  Download,
  Search,
  SlidersHorizontal,
  Zap,
  ChevronDown,
  ChevronRight,
  Link2,
  Upload,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { LpFormBuilder } from "@/components/lp/LpFormBuilder";
import { MetaFormEditor } from "@/components/lp/MetaFormEditor";
import { useLpForms, useDeleteLpForm, useCreateLpForm } from "@/hooks/useLpForms";
import { useMetaLeadForms, useDeleteMetaLeadForm, useUpdateMetaLeadForm, useMetaConnectedPages, type MetaLeadForm } from "@/hooks/useMetaLeadForms";
import { usePipelines } from "@/hooks/usePipelines";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { LpForm } from "@/hooks/useLpForms";
import { toast } from "sonner";
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
import { useAllScoreCategoryItems } from "@/hooks/useScoreCategories";

type LpTab = "forms" | "log-envios";

// ─── KPI stat card ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 border border-border bg-card rounded-[2px] px-4 py-3">
      <div className={cn("w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0", accent ?? "bg-primary/10")}>
        <Icon className={cn("w-4 h-4", accent ? "text-foreground/70" : "text-primary")} strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── New Form Type Chooser ────────────────────────────────────────────────────
function NewFormTypeChooser({ onSite, onClose }: { onSite: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-sm font-semibold text-foreground">Criar novo formulário</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Selecione o tipo de formulário</p>
        </div>
        <div className="space-y-2.5">
          <button
            onClick={onSite}
            className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors group flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0 text-lg">
              🌐
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Form Site</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Formulário para seu site ou landing page</p>
            </div>
          </button>
          <button
            onClick={() => { onClose(); navigate("/settings/general/integracoes?tab=meta-leads"); }}
            className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-[#1877F2]/40 hover:bg-[#1877F2]/5 transition-colors group flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0 text-lg">
              📘
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground group-hover:text-[#1877F2] transition-colors">Form Meta</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Conectar e sincronizar formulários do Facebook/Instagram Lead Ads</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const LpPro = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LpTab>("forms");
  const [showTypeChooser, setShowTypeChooser] = useState(false);

  const [editingForm, setEditingForm] = useState<LpForm | null | undefined>(undefined);
  const [editingMetaForm, setEditingMetaForm] = useState<MetaLeadForm | undefined>(undefined);
  const { data: forms = [] } = useLpForms();
  const { data: metaForms = [] } = useMetaLeadForms();
  const { data: connectedPages = [] } = useMetaConnectedPages();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const totalForms = forms.length + metaForms.length;

  async function handleSync() {
    if (connectedPages.length === 0) return;
    setSyncing(true);
    try {
      let totalNew = 0;
      let totalUpdated = 0;
      for (const page of connectedPages) {
        const { data, error } = await supabase.functions.invoke("meta-leadgen-sync", {
          body: { action: "sync", page_id: page.page_id },
        });
        if (error) throw error;
        totalNew += data?.new ?? 0;
        totalUpdated += data?.updated ?? 0;
      }
      toast.success(`Sincronizado: ${totalNew} novos, ${totalUpdated} atualizados`);
      queryClient.invalidateQueries({ queryKey: ["meta-lead-forms"] });
    } catch (err) {
      toast.error(`Erro ao sincronizar: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  // Site form builder
  if (activeTab === "forms" && editingForm !== undefined) {
    return (
      <div className="h-full overflow-hidden">
        <LpFormBuilder key={editingForm?.id ?? "new"} form={editingForm} onBack={() => setEditingForm(undefined)} />
      </div>
    );
  }

  // Meta form editor
  if (activeTab === "forms" && editingMetaForm !== undefined) {
    return (
      <div className="h-full overflow-hidden">
        <MetaFormEditor key={editingMetaForm.id} form={editingMetaForm} onBack={() => setEditingMetaForm(undefined)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex-none border-b border-border bg-card dark:bg-zinc-950">
        <div className="flex items-center px-6 h-[45px]">
          {(["forms", "log-envios"] as LpTab[]).map((tab) => {
            const count = tab === "forms" ? totalForms : 0;
            const label = tab === "forms" ? t("lpPro.tabs.forms") : "Leads Recebidos";
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 px-4 h-full text-[13px] border-b-2 transition-colors",
                  activeTab === tab
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                {count > 0 && tab === "forms" && (
                  <span className={cn(
                    "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] leading-none",
                    activeTab === tab ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="flex-1" />
          {activeTab === "forms" && (
            <div className="flex items-center gap-2">
              {connectedPages.length > 0 && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 h-[30px] px-3 rounded-[4px] border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} strokeWidth={1.5} />
                  {syncing ? "Sincronizando..." : "Sincronizar Meta"}
                </button>
              )}
              <Button size="sm" className="h-[30px] px-3 text-xs gap-1.5 rounded-[4px]" onClick={() => setShowTypeChooser(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                {t("lpPro.form.new")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "forms" && (
          <FormsTab
            t={t}
            forms={forms}
            metaForms={metaForms}
            onNew={() => setShowTypeChooser(true)}
            onEdit={setEditingForm}
            onEditMeta={setEditingMetaForm}
          />
        )}
        {activeTab === "log-envios" && <DisparosTab forms={forms} metaForms={metaForms} />}
      </div>

      {/* ── Type Chooser Modal ─────────────────────────────────────────── */}
      {showTypeChooser && (
        <NewFormTypeChooser
          onSite={() => { setShowTypeChooser(false); setEditingForm(null); }}
          onClose={() => setShowTypeChooser(false)}
        />
      )}
    </div>
  );
};

// ─── Forms Tab ────────────────────────────────────────────────────────────────
interface FormsTabProps {
  t: (key: string) => string;
  forms: LpForm[];
  metaForms: MetaLeadForm[];
  onNew: () => void;
  onEdit: (form: LpForm) => void;
  onEditMeta: (form: MetaLeadForm) => void;
}

// ─── Unified form type ───────────────────────────────────────────────────────
type UnifiedForm =
  | (LpForm & { _type: "site" })
  | (MetaLeadForm & { _type: "meta" });

function useFormSubCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ["form-pro-sub-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("form_pro_submissions").select("form_id");
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.form_id) counts[row.form_id] = (counts[row.form_id] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 60_000,
  });
}

function formModeInfo(mode?: string): { label: string; icon: React.ElementType; color: string } {
  switch (mode) {
    case "chatbot": return { label: "Chatbot", icon: Bot, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" };
    case "steps":   return { label: "Passos",  icon: Layers, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" };
    default:        return { label: "Clássico",icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
  }
}

function formDisplayInfo(style?: string): { label: string; icon: React.ElementType; color: string } {
  switch (style) {
    case "floating":   return { label: "Flutuante", icon: PanelRight, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" };
    case "fullscreen": return { label: "Fullscreen",icon: MessageSquare, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    default:           return { label: "Inline",    icon: SlidersHorizontal, color: "bg-muted text-muted-foreground" };
  }
}

// ─── Form Mini Preview ────────────────────────────────────────────────────────
function FormMiniPreview({ form }: { form: LpForm }) {
  const visible = form.fields.filter((f) => f.type !== "hidden").slice(0, 4);
  const remaining = Math.max(0, form.fields.filter((f) => f.type !== "hidden").length - 4);

  const fieldColor = (type: string) => {
    switch (type) {
      case "email": return "bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40";
      case "phone": return "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40";
      case "select": case "radio": return "bg-violet-100 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40";
      case "textarea": return "bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40";
      case "checkbox": return "bg-pink-100 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800/40";
      default: return "bg-muted border-border";
    }
  };

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[10px] text-muted-foreground/50 italic">Sem campos</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-3">
      {visible.map((f) => (
        <div key={f.id} className={cn("rounded-[2px] border px-2 py-1", fieldColor(f.type))}>
          <p className="text-[9px] font-semibold text-foreground/60 leading-none mb-0.5 truncate">{f.label}</p>
          <div className="h-[3px] w-2/3 rounded-full bg-foreground/10" />
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-[9px] text-muted-foreground/50 text-center">+{remaining} campo{remaining !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

// ─── Type Badge ──────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: "site" | "meta" }) {
  if (type === "meta") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] bg-[#1877F2]/10 text-[#1877F2]">
        📘 Meta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
      🌐 Site
    </span>
  );
}

// ─── Meta Form Mini Preview ──────────────────────────────────────────────────
function MetaFormMiniPreview({ form }: { form: MetaLeadForm }) {
  const fields = (form.field_mapping ?? []).slice(0, 4);
  const remaining = Math.max(0, (form.field_mapping ?? []).length - 4);

  const fieldColor = (metaType: string) => {
    if (metaType === "prefilled") return "bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40";
    return "bg-violet-100 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40";
  };

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[10px] text-muted-foreground/50 italic">Sem campos</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-3">
      {fields.map((f, i) => (
        <div key={i} className={cn("rounded-[2px] border px-2 py-1", fieldColor(f.meta_type))}>
          <p className="text-[9px] font-semibold text-foreground/60 leading-none mb-0.5 truncate">{f.label}</p>
          <div className="h-[3px] w-2/3 rounded-full bg-foreground/10" />
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-[9px] text-muted-foreground/50 text-center">+{remaining} campo{remaining !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

// ─── Meta Form Card ──────────────────────────────────────────────────────────
function MetaFormCard({
  form,
  subCount,
  onEdit,
  onArchive,
  archiveIsPending,
}: {
  form: MetaLeadForm;
  subCount: number;
  onEdit: (form: MetaLeadForm) => void;
  onArchive: (id: string, e: React.MouseEvent) => void;
  archiveIsPending: boolean;
}) {
  const adsManagerUrl = `https://www.facebook.com/ads/lead_forms/?page_id=${form.page_id}`;
  const prefilledCount = (form.field_mapping ?? []).filter((f) => f.meta_type === "prefilled").length;
  const customCount = (form.field_mapping ?? []).filter((f) => f.meta_type === "custom").length;

  return (
    <div
      onClick={() => onEdit(form)}
      className="group border border-border bg-card rounded-[2px] hover:border-[#1877F2]/30 transition-all cursor-pointer flex flex-col overflow-hidden"
    >
      {/* Mini preview area */}
      <div className="bg-muted border-b border-border h-[120px] overflow-hidden relative">
        <MetaFormMiniPreview form={form} />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(form)}
            className="flex items-center gap-1.5 h-[30px] px-3 rounded-[4px] bg-[#1877F2] text-white text-[11px] font-semibold hover:opacity-90 transition-opacity"
          >
            <SlidersHorizontal className="w-3 h-3" strokeWidth={1.5} />
            Configurar
          </button>
          <a
            href={adsManagerUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 h-[30px] px-3 rounded-[4px] bg-card border border-border text-foreground text-[11px] font-semibold hover:bg-muted transition-colors"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
            Meta Ads
          </a>
        </div>
      </div>

      {/* Card body */}
      <div className="flex-1 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-sm font-semibold text-foreground truncate leading-tight flex-1">{form.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <TypeBadge type="meta" />
          {form.status === "unmapped" || (form.field_mapping ?? []).length === 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-[2px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
              ⚠️ Configurar
            </span>
          ) : form.status === "archived" ? (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-[2px] bg-muted text-muted-foreground">
              Arquivado
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-[2px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              ✅ Ativo
            </span>
          )}
          {form.pipeline_id && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-primary">
              <Zap className="w-2.5 h-2.5" strokeWidth={1.5} />
              Pipeline
            </span>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">{prefilledCount + customCount}</span> campos
          </span>
          {subCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
              <BarChart2 className="w-2.5 h-2.5" strokeWidth={1.5} />
              {subCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <a
            href={adsManagerUrl}
            target="_blank"
            rel="noreferrer"
            title="Abrir no Meta Ads Manager"
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-[#1877F2] hover:bg-[#1877F2]/10 transition-colors"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
          </a>
          <button
            onClick={(e) => onArchive(form.id, e)}
            disabled={archiveIsPending || form.status === "archived"}
            title={form.status === "archived" ? "Já arquivado" : "Arquivar"}
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Card ────────────────────────────────────────────────────────────────
function FormCard({
  form,
  subCount,
  onEdit,
  onClone,
  onDelete,
  cloneIsPending,
  deleteIsPending,
}: {
  form: LpForm;
  subCount: number;
  onEdit: (f: LpForm) => void;
  onClone: (f: LpForm, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  cloneIsPending: boolean;
  deleteIsPending: boolean;
}) {
  const mode = formModeInfo(form.settings?.mode);
  const display = formDisplayInfo(form.settings?.display_style);
  const ModeIcon = mode.icon;
  const DisplayIcon = display.icon;
  const publicUrl = `${window.location.origin}/f/${form.id}`;

  function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link público copiado!");
  }

  return (
    <div
      onClick={() => onEdit(form)}
      className="group border border-border bg-card rounded-[2px] hover:border-primary/30 transition-all cursor-pointer flex flex-col overflow-hidden"
    >
      {/* Mini preview area */}
      <div className="bg-muted border-b border-border h-[120px] overflow-hidden relative">
        <FormMiniPreview form={form} />
        {/* Overlay actions on hover */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(form)}
            className="flex items-center gap-1.5 h-[30px] px-3 rounded-[4px] bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Pencil className="w-3 h-3" strokeWidth={1.5} />
            Editar
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 h-[30px] px-3 rounded-[4px] bg-card border border-border text-foreground text-[11px] font-semibold hover:bg-muted transition-colors"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
            Abrir
          </a>
        </div>
      </div>

      {/* Card body */}
      <div className="flex-1 p-3">
        <p className="text-sm font-semibold text-foreground truncate leading-tight mb-1">{form.name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <TypeBadge type="site" />
          <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]", mode.color)}>
            <ModeIcon className="w-2.5 h-2.5" strokeWidth={1.5} />
            {mode.label}
          </span>
          <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-[2px]", display.color)}>
            <DisplayIcon className="w-2.5 h-2.5" strokeWidth={1.5} />
            {display.label}
          </span>
          {form.pipeline_id && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-primary">
              <Zap className="w-2.5 h-2.5" strokeWidth={1.5} />
              Pipeline
            </span>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">{form.fields.filter((f) => f.type !== "hidden").length}</span> campos
          </span>
          {subCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
              <BarChart2 className="w-2.5 h-2.5" strokeWidth={1.5} />
              {subCount}
            </span>
          )}
        </div>
        {/* Action buttons */}
        <div
          className="flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={copyLink}
            title="Copiar link público"
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Link2 className="w-3 h-3" strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => onClone(form, e)}
            disabled={cloneIsPending}
            title="Duplicar"
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Copy className="w-3 h-3" strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => onDelete(form.id, e)}
            disabled={deleteIsPending}
            title="Excluir"
            className="w-6 h-6 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Forms Tab ────────────────────────────────────────────────────────────────
const FormsTab = ({ t, forms, metaForms, onNew, onEdit, onEditMeta }: FormsTabProps) => {
  const deleteForm = useDeleteLpForm();
  const createForm = useCreateLpForm();
  const updateMetaForm = useUpdateMetaLeadForm();
  const { data: subCounts = {} } = useFormSubCounts();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Unified grid: combine site + meta forms, sorted by updated_at desc
  const unifiedForms = useMemo<UnifiedForm[]>(() => {
    const site: UnifiedForm[] = forms.map((f) => ({ ...f, _type: "site" as const }));
    const meta: UnifiedForm[] = metaForms.map((f) => ({ ...f, _type: "meta" as const }));
    return [...site, ...meta].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [forms, metaForms]);

  async function handleClone(form: LpForm, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await createForm.mutateAsync({
        name: `${form.name} (cópia)`,
        pipeline_id: form.pipeline_id,
        fields: form.fields,
        settings: form.settings,
      });
      toast.success("Formulário duplicado!");
    } catch {
      toast.error("Erro ao duplicar formulário");
    }
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const form = forms.find((f) => f.id === id);
    setDeleteTarget({ id, name: form?.name ?? "este formulário" });
  }

  function handleArchive(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    updateMetaForm.mutate(
      { id, status: "archived" },
      {
        onSuccess: () => toast.success("Formulário Meta arquivado"),
        onError: () => toast.error("Erro ao arquivar formulário"),
      }
    );
  }

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteForm.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteForm]);

  if (unifiedForms.length === 0) {
    return (
      <div className="border border-border bg-card rounded-[2px]">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-12 h-12 rounded-[2px] bg-muted flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">{t("lpPro.form.emptyTitle")}</p>
          <p className="text-xs text-muted-foreground max-w-xs mb-5">{t("lpPro.form.emptyDescription")}</p>
          <Button size="sm" className="h-[30px] px-3 text-xs gap-1.5 rounded-[4px]" onClick={onNew}>
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            {t("lpPro.form.new")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {unifiedForms.map((uf) =>
          uf._type === "site" ? (
            <FormCard
              key={`site-${uf.id}`}
              form={uf}
              subCount={subCounts[uf.id] ?? 0}
              onEdit={onEdit}
              onClone={handleClone}
              onDelete={handleDelete}
              cloneIsPending={createForm.isPending}
              deleteIsPending={deleteForm.isPending}
            />
          ) : (
            <MetaFormCard
              key={`meta-${uf.id}`}
              form={uf}
              subCount={subCounts[uf.id] ?? 0}
              onEdit={onEditMeta}
              onArchive={handleArchive}
              archiveIsPending={updateMetaForm.isPending}
            />
          )
        )}
        {/* Add new card */}
        <button
          onClick={onNew}
          className="border-2 border-dashed border-border rounded-[2px] h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50 transition-all"
        >
          <div className="w-9 h-9 rounded-[2px] border-2 border-dashed border-current flex items-center justify-center">
            <Plus className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <span className="text-[12px] font-medium">{t("lpPro.form.new")}</span>
        </button>
      </div>
    </div>

    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
          <AlertDialogDescription>
            O formulário <strong>{deleteTarget?.name}</strong> será excluído permanentemente,
            incluindo todos os envios associados. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {deleteForm.isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};

// ─── Disparos Tab ─────────────────────────────────────────────────────────────
interface Submission {
  id: string;
  form_id: string | null;
  meta_form_id: string | null;
  page_id: string | null;
  source: "site" | "meta";
  data: Record<string, string>;
  lead_id: string | null;
  submitted_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ip_address: string | null;
  form_pro_forms: { name: string; fields: { id: string; label: string; type?: string; crm_field?: string; options?: { value: string; label: string }[] }[] } | null;
  clients_people: { name: string; email: string | null; whatsapp: string | null; score_matrix?: { name: string | null; score_number: number } | null } | null;
  leads: { score: number | null } | null;
}

function extractPersonInfo(sub: Submission): { name?: string; email?: string; whatsapp?: string } {
  if (sub.clients_people) {
    return { name: sub.clients_people.name, email: sub.clients_people.email ?? undefined, whatsapp: sub.clients_people.whatsapp ?? undefined };
  }
  const fields = sub.form_pro_forms?.fields ?? [];
  const result: { name?: string; email?: string; whatsapp?: string } = {};
  for (const f of fields) {
    const val = sub.data?.[f.id];
    if (!val) continue;
    if (f.crm_field === "pessoa.nome" || f.crm_field === "pessoa.name") result.name = val;
    else if (f.crm_field === "pessoa.email") result.email = val;
    else if (f.crm_field === "pessoa.whatsapp") result.whatsapp = val;
  }
  return result;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function fmtPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const local = d.slice(2);
    if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  return raw;
}

function exportCsv(submissions: Submission[]) {
  const fieldMap = new Map<string, string>();
  for (const sub of submissions) {
    for (const f of sub.form_pro_forms?.fields ?? []) {
      if (f.type !== "hidden" && !fieldMap.has(f.id)) {
        fieldMap.set(f.id, f.label);
      }
    }
  }
  const dynamicFieldIds = [...fieldMap.keys()];
  const dynamicFieldLabels = dynamicFieldIds.map((id) => fieldMap.get(id)!);

  const fixedHeaders = [
    "Data/Hora", "Formulário", "Fonte", "Nome", "Email", "WhatsApp",
    "Lead criado", "UTM Source", "UTM Medium", "UTM Campaign", "UTM Content", "UTM Term", "IP",
  ];
  const headers = [...fixedHeaders, ...dynamicFieldLabels];

  const rows = submissions.map((sub) => {
    const p = extractPersonInfo(sub);
    const fixed = [
      fmtDate(sub.submitted_at),
      sub.form_pro_forms?.name ?? "",
      sub.source === "meta" ? "Meta" : "Site",
      p.name ?? "",
      p.email ?? "",
      p.whatsapp ? fmtPhone(p.whatsapp) : "",
      sub.lead_id ? "Sim" : "Não",
      sub.utm_source ?? "",
      sub.utm_medium ?? "",
      sub.utm_campaign ?? "",
      sub.utm_content ?? "",
      sub.utm_term ?? "",
      sub.ip_address ?? "",
    ];
    const dynamic = dynamicFieldIds.map((id) => sub.data?.[id] ?? "");
    return [...fixed, ...dynamic];
  });

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `form-envios-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 50;

type DateRange = "all" | "today" | "7d" | "30d" | "90d";

function dateRangeCutoff(range: DateRange): string | null {
  if (range === "all") return null;
  const now = Date.now();
  const ms: Record<Exclude<DateRange, "all">, number> = {
    today: 86_400_000,
    "7d":  7 * 86_400_000,
    "30d": 30 * 86_400_000,
    "90d": 90 * 86_400_000,
  };
  return new Date(now - ms[range as Exclude<DateRange, "all">]).toISOString();
}

function ScoreBadge({ score, name }: { score: number | null; name?: string | null }) {
  if (score === null && !name) return <span className="text-[11px] text-muted-foreground">—</span>;
  const s = score ?? 0;
  const color = s >= 70
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : s >= 40
    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded-[4px] ${color}`}>
      {name || score}
    </span>
  );
}

type SourceFilter = "all" | "site" | "meta";

const DisparosTab = ({ forms, metaForms }: { forms: LpForm[]; metaForms: MetaLeadForm[] }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Import modal state ──
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFormId, setImportFormId] = useState<string>("");
  const [importPipelineId, setImportPipelineId] = useState<string>("");
  const [importStageId, setImportStageId] = useState<string>("");
  const [importSendMessage, setImportSendMessage] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; imported: number; skipped_duplicates: number } | null>(null);

  const { pipelines, stages } = usePipelines();
  const importStages = useMemo(
    () => importPipelineId ? stages.filter((s) => s.leads_pipelines_id === importPipelineId).sort((a, b) => a.order_index - b.order_index) : [],
    [importPipelineId, stages]
  );

  const handleImport = async () => {
    if (!importFormId) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("meta-leadgen-sync", {
        body: {
          action: "import-leads",
          form_id: importFormId,
          pipeline_id: importPipelineId || undefined,
          stage_id: importStageId || undefined,
          send_message: importSendMessage,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.error) throw new Error(resp.error.message ?? "Erro ao importar");
      const result = resp.data as { success: boolean; total: number; imported: number; skipped_duplicates: number; error?: string };
      if (!result.success) throw new Error(result.error ?? "Erro desconhecido");
      setImportResult({ total: result.total, imported: result.imported, skipped_duplicates: result.skipped_duplicates });
      toast.success(`${result.imported} leads importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["form_pro_submissions_stats"] });
      queryClient.invalidateQueries({ queryKey: ["form_pro_submissions_page"] });
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const openImportModal = () => {
    setImportFormId("");
    setImportPipelineId("");
    setImportStageId("");
    setImportSendMessage(false);
    setImportResult(null);
    setShowImportModal(true);
  };

  // Resolve score item UUIDs → names for the expanded row display
  const { data: allScoreItems = [] } = useAllScoreCategoryItems();
  const scoreItemNameMap = useMemo(
    () => new Map(allScoreItems.map((i) => [i.id, i.name])),
    [allScoreItems]
  );

  const metaFormIds = useMemo(() => new Set(metaForms.map((f) => f.id)), [metaForms]);
  const handleFormFilter = (id: string) => { setSelectedFormId(id); setPage(0); };
  const handleSourceFilter = (s: SourceFilter) => { setSourceFilter(s); setPage(0); };
  const handleSearch = (term: string) => { setSearch(term); setPage(0); };
  const handleDateRange = (r: DateRange) => { setDateRange(r); setPage(0); };

  const cutoff = dateRangeCutoff(dateRange);

  const { data: allStats = [] } = useQuery({
    queryKey: ["form_pro_submissions_stats", selectedFormId, dateRange, sourceFilter],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("form_pro_submissions")
        .select("submitted_at, lead_id, source");
      if (selectedFormId) {
        if (metaFormIds.has(selectedFormId)) q = q.eq("meta_form_id", selectedFormId);
        else q = q.eq("form_id", selectedFormId);
      }
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
      if (cutoff) q = q.gte("submitted_at", cutoff);
      const { data } = await q;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: pageResult, isLoading, error: pageError, refetch } = useQuery({
    queryKey: ["form_pro_submissions_page", selectedFormId, dateRange, sourceFilter, page],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("form_pro_submissions")
        .select("*, form_pro_forms(name, fields), clients_people(name, email, whatsapp, score, score_matrix:score_matrix(name, score_number))", { count: "exact" })
        .order("submitted_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (selectedFormId) {
        if (metaFormIds.has(selectedFormId)) q = q.eq("meta_form_id", selectedFormId);
        else q = q.eq("form_id", selectedFormId);
      }
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
      if (cutoff) q = q.gte("submitted_at", cutoff);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message ?? JSON.stringify(error));
      return { submissions: (data ?? []) as unknown as Submission[], total: count ?? 0 };
    },
    staleTime: 30_000,
    retry: 1,
  });

  const rawSubmissions = pageResult?.submissions ?? [];
  const total          = pageResult?.total ?? 0;
  const totalPages     = Math.ceil(total / PAGE_SIZE);

  const submissions = useMemo(() => {
    if (!search.trim()) return rawSubmissions;
    const term = search.toLowerCase().trim();
    return rawSubmissions.filter((sub) => {
      const p = extractPersonInfo(sub);
      return (
        p.name?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.whatsapp?.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
      );
    });
  }, [rawSubmissions, search]);

  const withLead   = allStats.filter((s) => s.lead_id).length;
  const convRate   = allStats.length > 0 ? Math.round((withLead / allStats.length) * 100) : 0;
  const siteCount  = allStats.filter((s) => s.source === "site").length;
  const metaCount  = allStats.filter((s) => s.source === "meta").length;

  return (
    <div className="space-y-4">
      {allStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total de envios" value={total}       icon={Send} />
          <StatCard label="🌐 Site"         value={siteCount}   icon={FileText}     accent="bg-blue-500/10" />
          <StatCard label="📘 Meta"         value={metaCount}   icon={ExternalLink}  accent="bg-[#1877F2]/10" />
          <StatCard label="Leads criados"   value={`${withLead} (${convRate}%)`}    icon={CheckCircle2} accent="bg-primary/10" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap border border-border bg-card rounded-[2px] px-4 py-2.5">
        <Send className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-foreground">Leads Recebidos</span>
        {allStats.length > 0 && convRate > 0 && (
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-[2px]">
            {convRate}% para lead
          </span>
        )}
        {/* Date range pills */}
        <div className="flex items-center gap-0.5 border border-border rounded-[2px] bg-muted p-0.5">
          {(["all", "today", "7d", "30d", "90d"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => handleDateRange(r)}
              className={cn(
                "h-6 px-2 text-[11px] font-semibold rounded-[2px] transition-colors",
                dateRange === r
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "all" ? "Tudo" : r === "today" ? "Hoje" : r}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar pessoa..."
            className="pl-8 pr-3 h-[30px] w-44 border border-border rounded-[4px] bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => handleSourceFilter(e.target.value as SourceFilter)}
          className="rounded-[4px] border border-border bg-background px-3 py-1.5 text-[13px] focus:outline-none"
        >
          <option value="all">Todas as fontes</option>
          <option value="site">🌐 Site</option>
          <option value="meta">📘 Meta</option>
        </select>
        <select
          value={selectedFormId}
          onChange={(e) => handleFormFilter(e.target.value)}
          className="rounded-[4px] border border-border bg-background px-3 py-1.5 text-[13px] max-w-[220px] focus:outline-none"
        >
          <option value="">Todos os formulários</option>
          {forms.map((f) => <option key={f.id} value={f.id}>🌐 {f.name}</option>)}
          {metaForms.map((f) => <option key={f.id} value={f.id}>📘 {f.name}</option>)}
        </select>
        {metaForms.length > 0 && (
          <button
            onClick={openImportModal}
            className="flex items-center gap-1.5 h-[30px] px-2.5 rounded-[4px] border border-[#1877F2]/30 text-xs text-[#1877F2] hover:bg-[#1877F2]/10 transition-colors font-medium"
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
            Importar Meta
          </button>
        )}
        {submissions.length > 0 && (
          <button
            onClick={() => exportCsv(submissions)}
            className="flex items-center gap-1.5 h-[30px] px-2.5 rounded-[4px] border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            CSV
          </button>
        )}
        <button onClick={() => refetch()} className="p-1.5 rounded-[4px] border border-border text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {pageError ? (
        <div className="border border-destructive/30 bg-destructive/5 rounded-[2px] px-4 py-3 text-sm text-destructive">
          Erro ao carregar envios: {(pageError as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Carregando...</div>
      ) : submissions.length === 0 ? (
        <div className="border border-border bg-card rounded-[2px]">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-10 h-10 rounded-[2px] bg-muted flex items-center justify-center mb-3">
              <Send className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nenhum envio ainda</p>
            <p className="text-xs text-muted-foreground">Os envios do formulário aparecerão aqui.</p>
          </div>
        </div>
      ) : (
        <div className="border border-border bg-card rounded-[2px] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="w-8 px-2 py-2.5" />
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">Formulário</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">Fonte</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">Pessoa</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">Contato</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">Score</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">Negócio</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold font-mono text-muted-foreground uppercase tracking-wide">UTM</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub, idx) => {
                const person = extractPersonInfo(sub);
                const isExpanded = expandedId === sub.id;
                const fields = sub.form_pro_forms?.fields ?? [];
                const filledFields = fields.filter(
                  (f) => sub.data?.[f.id] && f.type !== "hidden"
                );
                // For meta submissions: show data keys directly (CRM field paths)
                const isMetaSub = sub.source === "meta" && filledFields.length === 0 && sub.data;
                const metaDataEntries = isMetaSub
                  ? Object.entries(sub.data as Record<string, unknown>).filter(
                      ([k, v]) => v && !k.startsWith("_") && k !== "utm_source" && k !== "utm_medium" && k !== "utm_campaign" && k !== "utm_term" && k !== "utm_content"
                    )
                  : [];
                return (
                  <React.Fragment key={sub.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                      className={cn(
                        "border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                        idx % 2 !== 0 && !isExpanded && "bg-muted",
                        isExpanded && "bg-muted"
                      )}
                    >
                      <td className="px-2 py-2.5 text-center">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-foreground whitespace-nowrap">{fmtDate(sub.submitted_at)}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtRelative(sub.submitted_at)}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-foreground">{sub.form_pro_forms?.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <TypeBadge type={sub.source === "meta" ? "meta" : "site"} />
                      </td>
                      <td className="px-4 py-2.5">
                        {person.name ? (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium text-foreground truncate max-w-[160px]">{person.name}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-0.5">
                          {person.email && <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{person.email}</div>}
                          {person.whatsapp && <div className="text-[11px] text-muted-foreground">{fmtPhone(person.whatsapp)}</div>}
                          {!person.email && !person.whatsapp && <span className="text-[11px] text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <ScoreBadge
                          score={sub.clients_people?.score_matrix?.score_number ?? null}
                          name={sub.clients_people?.score_matrix?.name}
                        />
                      </td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {sub.lead_id ? (
                          <button
                            onClick={() => navigate(`/crm/list/${sub.lead_id}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-[2px] hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" /> Abrir lead
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-[2px]">
                            <XCircle className="w-3 h-3" /> Não criado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {sub.utm_source ? (
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-foreground">{sub.utm_source}</span>
                            {sub.utm_medium && <div className="text-[10px] text-muted-foreground">{sub.utm_medium}</div>}
                          </div>
                        ) : <span className="text-[11px] text-muted-foreground">—</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-border bg-muted">
                        <td colSpan={9} className="px-6 py-3">
                          {filledFields.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
                              {filledFields.map((f) => {
                                const rawVal = sub.data[f.id];
                                // Resolve score item UUIDs to human-readable names
                                // Fallback: check field options (form stores { value: uuid, label: name })
                                const optLabel = f.options?.find((o) => o.value === rawVal)?.label;
                                const displayVal = scoreItemNameMap.get(rawVal) ?? optLabel ?? rawVal;
                                return (
                                  <div key={f.id}>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{f.label}</p>
                                    <p className="text-xs text-foreground break-words">{displayVal}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : metaDataEntries.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
                              {metaDataEntries.map(([key, val]) => {
                                const label = key.replace(/^(pessoa|empresa)\./, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                                // Resolve score item UUIDs to human-readable names (meta submissions store raw UUIDs)
                                const strVal = String(val);
                                const displayVal = scoreItemNameMap.get(strVal) ?? strVal;
                                return (
                                  <div key={key}>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                                    <p className="text-xs text-foreground break-words">{displayVal}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Nenhum campo preenchido registrado.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted">
              <span className="text-[11px] text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-[30px] px-2.5 rounded-[4px] border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>
                <span className="text-[11px] text-muted-foreground px-2">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-[30px] px-2.5 rounded-[4px] border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Import Meta Leads Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !importing && setShowImportModal(false)}>
          <div className="bg-card border border-border rounded-[2px] w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#1877F2]" />
                Importar Leads do Meta
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Importa leads dos ultimos 90 dias do Meta Lead Ads. Leads duplicados sao ignorados automaticamente.
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Form selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Formulario Meta</label>
                <select
                  value={importFormId}
                  onChange={(e) => setImportFormId(e.target.value)}
                  className="w-full h-[30px] rounded-[4px] border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                  disabled={importing}
                >
                  <option value="">Selecione um formulario...</option>
                  {metaForms.filter((f) => f.status === "active").map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Pipeline selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pipeline (opcional — sobrescreve config do form)</label>
                <select
                  value={importPipelineId}
                  onChange={(e) => { setImportPipelineId(e.target.value); setImportStageId(""); }}
                  className="w-full h-[30px] rounded-[4px] border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                  disabled={importing}
                >
                  <option value="">Usar pipeline do formulario</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Stage selection */}
              {importPipelineId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Etapa inicial</label>
                  <select
                    value={importStageId}
                    onChange={(e) => setImportStageId(e.target.value)}
                    className="w-full h-[30px] rounded-[4px] border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    disabled={importing}
                  >
                    <option value="">Primeira etapa (padrao)</option>
                    {importStages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Send message toggle */}
              <div className="flex items-center justify-between py-2 px-3 border border-border rounded-[2px] bg-muted">
                <div>
                  <p className="text-xs font-medium text-foreground">Enviar mensagem automatica</p>
                  <p className="text-[10px] text-muted-foreground">Dispara as acoes pos-envio configuradas no formulario</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importSendMessage}
                    onChange={(e) => setImportSendMessage(e.target.checked)}
                    disabled={importing}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {/* Import result */}
              {importResult && (
                <div className="border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-[2px] px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300">Importacao concluida</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">{importResult.total}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400">Total Meta</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">{importResult.imported}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400">Importados</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-muted-foreground">{importResult.skipped_duplicates}</p>
                      <p className="text-[10px] text-muted-foreground">Ja existiam</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="h-[30px] text-xs rounded-[4px]"
              >
                {importResult ? "Fechar" : "Cancelar"}
              </Button>
              {!importResult && (
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={!importFormId || importing}
                  className="h-[30px] text-xs rounded-[4px] gap-1.5"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Importar Leads
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LpPro;
