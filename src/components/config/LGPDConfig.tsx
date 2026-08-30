import { useState } from "react";
import { Download, Loader2, Search, ShieldAlert, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useDataExportJobs,
  useRequestDataExport,
  useAnonymizePerson,
  useSearchPersonByEmail,
  type DataExportJob,
} from "@/hooks/useDataExportJobs";

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
  </div>
);

// ── Job status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: DataExportJob["status"] }) {
  const map: Record<DataExportJob["status"], { label: string; icon: React.ReactNode; class: string }> = {
    pending:    { label: "Pendente",     icon: <Clock className="w-3 h-3" />,         class: "text-muted-foreground border-border" },
    processing: { label: "Processando",  icon: <Loader2 className="w-3 h-3 animate-spin" />, class: "text-amber-600 border-amber-500/30 bg-amber-500/5" },
    done:       { label: "Pronto",       icon: <CheckCircle2 className="w-3 h-3" />,  class: "text-green-600 border-green-500/30 bg-green-500/5" },
    failed:     { label: "Falhou",       icon: <XCircle className="w-3 h-3" />,       class: "text-destructive border-destructive/30 bg-destructive/5" },
    expired:    { label: "Expirado",     icon: <AlertCircle className="w-3 h-3" />,   class: "text-muted-foreground/50 border-border" },
  };
  const { label, icon, class: cls } = map[status] ?? map.pending;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 flex items-center gap-1", cls)}>
      {icon}{label}
    </Badge>
  );
}

// ── Export section ─────────────────────────────────────────────────────────────
function ExportSection() {
  const { jobs, isLoading } = useDataExportJobs();
  const requestExport = useRequestDataExport();

  const handleRequest = async () => {
    try {
      await requestExport.mutateAsync();
      toast.success("Export solicitado. Você receberá o link em instantes.");
    } catch {
      toast.error("Erro ao solicitar export");
    }
  };

  const hasActiveJob = jobs.some((j) => j.status === "pending" || j.status === "processing");

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      <SectionHeader title="EXPORT DE DADOS" />
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed mb-3">
          Gera um arquivo ZIP com todos os dados do tenant: leads, contatos, mensagens (últimos 12 meses) e configurações (sem secrets). O link de download expira em 48 horas.
        </p>
        <Button
          size="sm"
          onClick={handleRequest}
          disabled={requestExport.isPending || hasActiveJob}
          className="h-8 text-[12px]"
        >
          {requestExport.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          Solicitar export completo
        </Button>
        {hasActiveJob && (
          <p className="text-[11px] text-amber-600 mt-2">Um export já está em processamento.</p>
        )}
      </div>

      {/* Jobs list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-[12px] text-muted-foreground/50">Nenhum export solicitado.</p>
        </div>
      ) : (
        jobs.map((job, i) => (
          <div key={job.id} className={cn("flex items-center gap-4 px-5 py-3", i < jobs.length - 1 && "border-b border-border")}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} />
                <span className="text-[11px] text-muted-foreground/50">{formatDate(job.created_at)}</span>
              </div>
              {job.status === "done" && job.expires_at && (
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  Expira {formatDate(job.expires_at)}
                </p>
              )}
              {job.status === "failed" && job.error_message && (
                <p className="text-[11px] text-destructive/70 mt-0.5 truncate">{job.error_message}</p>
              )}
            </div>
            {job.status === "done" && job.download_url && (
              <a href={job.download_url} download className="shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                  <Download className="w-3 h-3" />
                  Download
                </Button>
              </a>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Anonymize section ──────────────────────────────────────────────────────────
function AnonymizeSection() {
  const [email, setEmail] = useState("");
  const [foundPerson, setFoundPerson] = useState<{ id: string; name: string; email: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const searchPerson = useSearchPersonByEmail();
  const anonymizePerson = useAnonymizePerson();

  const handleSearch = async () => {
    if (!email.trim()) return;
    setSearched(false);
    setFoundPerson(null);
    try {
      const result = await searchPerson.mutateAsync(email.trim());
      setFoundPerson(result);
      setSearched(true);
    } catch {
      toast.error("Erro na busca");
    }
  };

  const handleAnonymize = async () => {
    if (!foundPerson) return;
    try {
      const result = await anonymizePerson.mutateAsync(foundPerson.id);
      toast.success(`Dados anonimizados em ${result.tables_affected.length} tabela(s)`);
      setFoundPerson(null);
      setEmail("");
      setSearched(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao anonimizar");
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      <SectionHeader title="DIREITO AO ESQUECIMENTO" />
      <div className="px-5 py-4 space-y-4">
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
          Anonimize todos os dados pessoais de um contato (nome, email, WhatsApp, CPF) substituindo por <code className="text-[11px] bg-muted px-1 rounded">REDACTED_{"{hash}"}</code>. Esta ação é irreversível.
        </p>

        <div className="flex items-center gap-2">
          <Input
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSearched(false); setFoundPerson(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-[34px] text-[13px] max-w-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSearch}
            disabled={!email.trim() || searchPerson.isPending}
            className="h-[34px] text-[12px] gap-1.5"
          >
            {searchPerson.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Buscar
          </Button>
        </div>

        {searched && !foundPerson && (
          <p className="text-[12px] text-muted-foreground/60">Nenhum contato encontrado com esse email.</p>
        )}

        {foundPerson && (
          <div className="border border-border rounded-[4px] px-4 py-3 space-y-2 bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-foreground">{foundPerson.name}</p>
                <p className="text-[11px] text-muted-foreground/60">{foundPerson.email}</p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-[11px] gap-1 shrink-0"
                onClick={() => setConfirmOpen(true)}
              >
                <ShieldAlert className="w-3 h-3" />
                Anonimizar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Confirmar anonimização</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              Os dados pessoais de <span className="font-semibold text-foreground">{foundPerson?.name}</span> ({foundPerson?.email}) serão substituídos por REDACTED em todas as tabelas do sistema. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnonymize}
              disabled={anonymizePerson.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {anonymizePerson.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Confirmar anonimização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const LGPDConfig = () => {
  return (
    <div className="space-y-6">
      <ExportSection />
      <AnonymizeSection />
    </div>
  );
};

export default LGPDConfig;
