import { useState, useEffect } from "react";
import {
  CheckCircle2, Link2, RefreshCw, Loader2, Trash2, Power, PowerOff,
  FileText, ExternalLink, ArrowRight, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBIProSettings } from "@/hooks/useBIProSettings";
import {
  useMetaConnectedPages, useMetaLeadForms, useUpdateMetaLeadForm, useDeleteMetaLeadForm,
  type MetaLeadForm,
} from "@/hooks/useMetaLeadForms";
import { MetaPageSelector } from "@/components/lp/MetaPageSelector";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Read-only Mapping Summary ────────────────────────────────────────

function FormMappingSummary({
  form,
  onEditInFormPro,
}: {
  form: MetaLeadForm;
  onEditInFormPro: () => void;
}) {
  const mappedFields = (form.field_mapping ?? []).filter((f) => f.crm_field);
  const totalFields = (form.raw_questions ?? []).length;

  return (
    <div className="px-4 pb-4 space-y-3">
      {mappedFields.length === 0 ? (
        <div className="text-center py-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Nenhum campo mapeado ainda.
          </p>
          <Button size="sm" variant="outline" onClick={onEditInFormPro} className="h-[30px] text-xs gap-1.5">
            <ArrowRight className="w-3 h-3" />
            Configurar no Form PRO
          </Button>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-[4px] overflow-hidden">
            <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 px-3 py-1.5 bg-muted border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              <span>Campo Meta</span>
              <span />
              <span>Campo CRM</span>
            </div>
            {mappedFields.map((m) => (
              <div
                key={m.meta_field}
                className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 px-3 py-2 border-b border-border last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{m.label}</p>
                  <span className="text-[9px] text-muted-foreground font-mono">{m.meta_field}</span>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                <p className="text-xs text-foreground truncate">{m.crm_field}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground">
              {mappedFields.length}/{totalFields} campos mapeados
            </span>
            <Button size="sm" variant="outline" onClick={onEditInFormPro} className="h-[30px] px-3 text-xs gap-1.5">
              <ArrowRight className="w-3 h-3" />
              Editar no Form PRO
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function FormProConfig() {
  const navigate = useNavigate();
  const { settings: biSettings } = useBIProSettings();
  const { data: connectedPages = [], isLoading: pagesLoading } = useMetaConnectedPages();
  const { data: metaForms = [], isLoading: formsLoading } = useMetaLeadForms();
  const updateForm = useUpdateMetaLeadForm();
  const deleteForm = useDeleteMetaLeadForm();
  const queryClient = useQueryClient();
  const [pendingOAuthToken, setPendingOAuthToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("meta_leadforms_oauth_pending");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.access_token) setPendingOAuthToken(parsed.access_token);
      } catch { /* ignore */ }
      sessionStorage.removeItem("meta_leadforms_oauth_pending");
    }
  }, []);

  function initiateMetaOAuth() {
    const appId = biSettings?.meta_app_id;
    if (!appId) {
      toast.error("Configure o Meta App ID em Integrações → Meta Ads primeiro");
      return;
    }
    const state = crypto.randomUUID();
    sessionStorage.setItem("meta_oauth_state", state);
    sessionStorage.setItem("meta_oauth_return", "/settings/general/integracoes?tab=meta-leads");
    const url = new URL("https://www.facebook.com/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", `${window.location.origin}/oauth/meta/callback`);
    url.searchParams.set("scope", "ads_read,business_management,pages_show_list,pages_read_engagement,pages_manage_ads,leads_retrieval");
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    window.location.href = url.toString();
  }

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
        if (!data?.success) throw new Error(data?.error ?? "Sync falhou sem mensagem");
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

  function handlePageConnected() {
    setPendingOAuthToken(null);
    queryClient.invalidateQueries({ queryKey: ["meta-connected-pages"] });
    queryClient.invalidateQueries({ queryKey: ["meta-lead-forms"] });
    setTimeout(() => { handleSync(); }, 500);
  }

  async function handleToggleStatus(form: MetaLeadForm, e: React.MouseEvent) {
    e.stopPropagation();
    const newStatus = form.status === "active" ? "archived" : "active";
    try {
      await updateForm.mutateAsync({ id: form.id, status: newStatus });
      toast.success(newStatus === "active" ? "Formulário ativado" : "Formulário desativado");
    } catch {
      toast.error("Erro ao alterar status do formulário");
    }
  }

  async function handleDeleteForm() {
    if (!deletingFormId) return;
    try {
      await deleteForm.mutateAsync(deletingFormId);
      toast.success("Formulário removido do sistema");
      if (expandedFormId === deletingFormId) setExpandedFormId(null);
    } catch {
      toast.error("Erro ao remover formulário");
    } finally {
      setDeletingFormId(null);
    }
  }

  const statusLabel = (s: string) => {
    if (s === "active") return { text: "Ativo", color: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30" };
    if (s === "unmapped") return { text: "Não mapeado", color: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30" };
    return { text: "Desativado", color: "text-muted-foreground bg-muted" };
  };

  const formToDelete = metaForms.find((f) => f.id === deletingFormId);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground">Meta Lead Ads</h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          Conexão com Facebook Pages, sincronização e gestão de formulários Lead Ads.
        </p>
      </div>

      {/* Connection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-foreground">Conexão</h2>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Facebook Page</span>
        </div>

        {pagesLoading ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Carregando...
          </div>
        ) : pendingOAuthToken ? (
          <MetaPageSelector userAccessToken={pendingOAuthToken} onConnected={handlePageConnected} />
        ) : connectedPages.length > 0 ? (
          <div className="border border-border rounded-[6px] bg-card overflow-hidden">
            {connectedPages.map((page) => (
              <div key={page.page_id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{page.page_name}</p>
                    <p className="text-[10px] text-muted-foreground">ID: {page.page_id} — Webhook ativo</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                  Conectada
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-muted">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 h-[30px] px-3 rounded-[4px] border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} strokeWidth={1.5} />
                {syncing ? "Sincronizando..." : "Sincronizar formulários"}
              </button>
              <Button size="sm" variant="ghost" onClick={initiateMetaOAuth} className="h-[30px] px-3 text-xs text-muted-foreground">
                Reconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-[6px] p-6 bg-card">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-[#1877F2]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Conectar Meta Lead Ads</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Conecte sua Facebook Page para receber leads de formulários do Facebook e Instagram automaticamente.
                </p>
              </div>
              <Button size="sm" onClick={initiateMetaOAuth} className="gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Conectar com Facebook
              </Button>
              {!biSettings?.meta_app_id && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Requer Meta App ID configurado em Integrações → Meta Ads
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Synced Forms */}
      {connectedPages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-foreground">Formulários</h2>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {metaForms.length} sincronizado{metaForms.length !== 1 ? "s" : ""}
            </span>
          </div>

          {formsLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando formulários...
            </div>
          ) : metaForms.length === 0 ? (
            <div className="border border-dashed border-border rounded-[6px] p-4 bg-card text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum formulário sincronizado. Clique em "Sincronizar formulários" acima.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-[6px] bg-card overflow-hidden divide-y divide-border">
              {metaForms.map((form) => {
                const st = statusLabel(form.status);
                const isExpanded = expandedFormId === form.id;
                const mappedFields = (form.field_mapping ?? []).filter((f) => f.crm_field).length;
                const totalFields = (form.raw_questions ?? []).length;
                return (
                  <div key={form.id}>
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedFormId(isExpanded ? null : form.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-[4px] bg-[#1877F2]/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#1877F2]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {totalFields} campo{totalFields !== 1 ? "s" : ""}
                              {mappedFields > 0 && ` · ${mappedFields} mapeado${mappedFields !== 1 ? "s" : ""}`}
                            </span>
                            {form.synced_at && (
                              <span className="text-[10px] text-muted-foreground">
                                · {new Date(form.synced_at).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", st.color)}>
                          {st.text}
                        </span>
                        <Button
                          size="sm" variant="ghost"
                          onClick={(e) => handleToggleStatus(form, e)}
                          className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-foreground"
                          title={form.status === "active" ? "Desativar" : "Ativar"}
                        >
                          {form.status === "active" ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={(e) => { e.stopPropagation(); setDeletingFormId(form.id); }}
                          className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-destructive"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <a
                          href={`https://www.facebook.com/ads/leadgen/form_editor/?id=${form.meta_form_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center h-[30px] w-[30px] rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Abrir no Meta"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                    {isExpanded && (
                      <FormMappingSummary
                        form={form}
                        onEditInFormPro={() => navigate('/lp')}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deletingFormId} onOpenChange={(open) => !open && setDeletingFormId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover formulário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover &quot;{formToDelete?.name}&quot; do sistema?
              O formulário continuará existindo no Meta Ads, mas não receberá mais leads aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteForm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
