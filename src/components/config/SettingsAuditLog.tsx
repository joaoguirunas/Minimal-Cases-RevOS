import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsAuditLog } from "@/hooks/useSettingsAuditLog";
import { useUsers } from "@/hooks/useUsuarios";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
  geral: "Geral",
  integracoes: "Integrações",
  omni: "OMNI PRO",
};

const SECTIONS = [
  { value: "all", label: "Todas as seções" },
  { value: "geral", label: "Geral" },
  { value: "integracoes", label: "Integrações" },
  { value: "omni", label: "OMNI PRO" },
];

function HashValue({ value, isSensitive }: { value: string | null; isSensitive: boolean }) {
  const [revealed, setRevealed] = useState(false);

  if (value === null) return <span className="text-muted-foreground/40 italic text-[11px]">—</span>;

  if (isSensitive) {
    return (
      <span className="flex items-center gap-1">
        <code className="text-[10px] font-mono text-muted-foreground/60">
          {revealed ? value : `${value.slice(0, 8)}…`}
        </code>
        <button
          onClick={() => setRevealed(v => !v)}
          className="p-0.5 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground"
          title={revealed ? "Ocultar" : "Ver hash completo"}
        >
          {revealed ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
        </button>
      </span>
    );
  }

  return (
    <code className="text-[11px] font-mono text-foreground/80 max-w-[160px] truncate block">
      {value}
    </code>
  );
}

export default function SettingsAuditLog() {
  const [section, setSection] = useState("all");
  const [userId, setUserId] = useState("all");
  const [page, setPage] = useState(0);

  const { data: entries = [], isLoading, error } = useSettingsAuditLog({
    section: section === "all" ? undefined : section,
    user_id: userId === "all" ? undefined : userId,
    page,
  });

  const { data: users = [] } = useUsers();

  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setPage(0);
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={section} onValueChange={handleFilterChange(setSection)}>
          <SelectTrigger className="h-[30px] text-[12px] w-44 rounded-[4px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTIONS.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-[12px]">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userId} onValueChange={handleFilterChange(setUserId)}>
          <SelectTrigger className="h-[30px] text-[12px] w-44 rounded-[4px]">
            <SelectValue placeholder="Todos os usuários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[12px]">Todos os usuários</SelectItem>
            {users.map((u: any) => (
              <SelectItem key={u.id} value={u.auth_user_id ?? u.id} className="text-[12px]">
                {u.name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[140px_1fr_120px_140px_140px] gap-0 border-b border-border bg-muted px-4 py-2">
          {["Data/Hora", "Campo", "Seção", "Valor anterior", "Novo valor"].map(h => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{h}</span>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-[12px] text-destructive/70">
            Erro ao carregar audit log. Verifique se a tabela foi criada.
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <ShieldCheck className="w-8 h-8 opacity-20" />
            <p className="text-[13px]">Nenhuma alteração registrada</p>
            <p className="text-[11px] opacity-60">Mudanças em configurações aparecerão aqui</p>
          </div>
        )}

        {!isLoading && !error && entries.map((entry, i) => (
          <div
            key={entry.id}
            className={cn(
              "grid grid-cols-[140px_1fr_120px_140px_140px] gap-0 px-4 py-2.5 items-start border-b border-border last:border-0 hover:bg-muted/40 transition-colors",
              i % 2 === 1 && "bg-muted/20"
            )}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-foreground/80">
                {format(new Date(entry.changed_at), "dd/MM HH:mm", { locale: ptBR })}
              </p>
              {entry.user_name && (
                <p className="text-[10px] text-muted-foreground/60 truncate">{entry.user_name}</p>
              )}
            </div>

            <p className="text-[12px] font-mono text-foreground/80 truncate">
              {entry.field}
              {entry.is_sensitive && (
                <span className="ml-1.5 text-[9px] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5">hash</span>
              )}
            </p>

            <p className="text-[11px] text-muted-foreground/70">
              {SECTION_LABELS[entry.section] ?? entry.section}
            </p>

            <HashValue value={entry.old_value} isSensitive={entry.is_sensitive} />
            <HashValue value={entry.new_value} isSensitive={entry.is_sensitive} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground/60">
          Página {page + 1} · 20 registros por página
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-[28px] px-2 rounded-[4px]"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-[28px] px-2 rounded-[4px]"
            disabled={entries.length < 20}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
