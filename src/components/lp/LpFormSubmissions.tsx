import { useState } from "react";
import { Inbox, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import { useLpFormSubmissions, useDeleteLpSubmission } from "@/hooks/useLpForms";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LpFormSubmissionsProps {
  formId: string;
}

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getFieldValue(data: Record<string, string>, key: string): string {
  return data[key] ?? "";
}

export function LpFormSubmissions({ formId }: LpFormSubmissionsProps) {
  const { data: submissions = [], isLoading } = useLpFormSubmissions(formId);
  const deleteSubmission = useDeleteLpSubmission();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(submissions.length / PAGE_SIZE);
  const visible = submissions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function findLabel(data: Record<string, string>): string {
    // Try to find a meaningful display name from the submission data
    const values = Object.values(data);
    const emailVal = values.find((v) => v.includes("@"));
    const nameVal = values.find((v) => v.length > 1 && v.length < 60 && !v.includes("@") && !v.startsWith("http"));
    return nameVal || emailVal || "—";
  }

  function findEmail(data: Record<string, string>): string {
    const val = Object.values(data).find((v) => v.includes("@"));
    return val || "—";
  }

  async function handleDelete(id: string) {
    try {
      await deleteSubmission.mutateAsync(id);
      toast.success("Registro removido");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando registros...
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
        <div className="w-12 h-12 rounded-[2px] bg-muted flex items-center justify-center">
          <Inbox className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Nenhum envio ainda</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            As submissões deste formulário aparecerão aqui
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {submissions.length} {submissions.length === 1 ? "envio" : "envios"} encontrados
        </p>
      </div>

      {/* Table */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_1.2fr_1fr_auto] gap-2 px-4 py-2 bg-muted border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Nome / Dados</span>
          <span>E-mail</span>
          <span>Data</span>
          <span className="w-16">Ações</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {visible.map((sub) => {
            const isOpen = expanded === sub.id;
            const label = findLabel(sub.data);
            const email = findEmail(sub.data);
            return (
              <div key={sub.id}>
                {/* Main row */}
                <div className="grid grid-cols-[1fr_1.2fr_1fr_auto] gap-2 px-4 py-2.5 items-center hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium text-foreground truncate">{label}</span>
                  <span className="text-xs text-muted-foreground truncate">{email}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(sub.submitted_at)}
                    {sub.utm_source && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-muted rounded-[2px] text-[10px]">{sub.utm_source}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 w-16">
                    <button
                      onClick={() => setExpanded(isOpen ? null : sub.id)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                      title="Ver dados"
                    >
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      disabled={deleteSubmission.isPending}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded disabled:opacity-50"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded data */}
                {isOpen && (
                  <div className="px-4 pb-3 pt-2 bg-muted border-t border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Dados do envio
                    </p>
                    <div className="space-y-1">
                      {Object.entries(sub.data).map(([k, v]) => (
                        <div key={k} className="flex gap-3 text-xs">
                          <span className="text-muted-foreground font-mono min-w-24 shrink-0 truncate">{k}</span>
                          <span className="text-foreground break-all">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                    {(sub.utm_source || sub.utm_medium || sub.utm_campaign) && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">UTMs</p>
                        <div className="flex flex-wrap gap-1.5">
                          {sub.utm_source && <span className="px-2 py-0.5 rounded-[2px] bg-muted text-[10px]">source: {sub.utm_source}</span>}
                          {sub.utm_medium && <span className="px-2 py-0.5 rounded-[2px] bg-muted text-[10px]">medium: {sub.utm_medium}</span>}
                          {sub.utm_campaign && <span className="px-2 py-0.5 rounded-[2px] bg-muted text-[10px]">campaign: {sub.utm_campaign}</span>}
                          {sub.utm_content && <span className="px-2 py-0.5 rounded-[2px] bg-muted text-[10px]">content: {sub.utm_content}</span>}
                          {sub.utm_term && <span className="px-2 py-0.5 rounded-[2px] bg-muted text-[10px]">term: {sub.utm_term}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="h-[30px] text-xs rounded-[4px]"
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {pageCount}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
            className="h-[30px] text-xs rounded-[4px]"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
