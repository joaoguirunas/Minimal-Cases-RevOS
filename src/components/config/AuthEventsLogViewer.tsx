import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LogIn,
  LogOut,
  ShieldAlert,
  RefreshCcw,
  Clock,
  Shield,
} from "lucide-react";
import { useAuthEventsLog, AuthEventType } from "@/hooks/useAuthEventsLog";
import { cn } from "@/lib/utils";

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  login_success:       { label: "Login bem-sucedido",   icon: LogIn,      color: "text-green-500" },
  login_failure:       { label: "Falha de login",        icon: ShieldAlert, color: "text-red-500" },
  logout:              { label: "Logout",                icon: LogOut,     color: "text-muted-foreground" },
  session_refresh:     { label: "Sessão renovada",       icon: RefreshCcw, color: "text-blue-400" },
  profile_fetch_timeout: { label: "Timeout de perfil",  icon: Clock,      color: "text-yellow-500" },
};

const EVENT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os eventos" },
  { value: "login_success",         label: "Login bem-sucedido" },
  { value: "login_failure",         label: "Falha de login" },
  { value: "logout",                label: "Logout" },
  { value: "session_refresh",       label: "Sessão renovada" },
  { value: "profile_fetch_timeout", label: "Timeout de perfil" },
];

const PAGE_SIZE = 25;

function EventRow({ event }: { event: ReturnType<typeof useAuthEventsLog>["data"] extends { events: infer E } ? E[number] : never }) {
  const meta = EVENT_META[event.event_type] ?? { label: event.event_type, icon: Shield, color: "text-muted-foreground" };
  const Icon = meta.icon;

  return (
    <div className="group flex items-start gap-3 px-5 py-3 border-b border-border hover:bg-muted/40 transition-colors text-xs">
      <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", meta.color)} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground">{meta.label}</span>
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-xs">
              {Object.entries(event.metadata)
                .filter(([k]) => k !== "reason")
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")}
            </span>
          )}
        </div>
        {(event.metadata as any)?.reason && (
          <p className="text-[10px] text-red-400 font-mono truncate">
            {(event.metadata as any).reason}
          </p>
        )}
        {event.user_id && (
          <p className="text-[10px] text-muted-foreground/50 font-mono">{event.user_id}</p>
        )}
      </div>
      <time className="shrink-0 text-[10px] text-muted-foreground/50 font-mono">
        {format(new Date(event.occurred_at), "dd/MM HH:mm:ss", { locale: ptBR })}
      </time>
    </div>
  );
}

export default function AuthEventsLogViewer() {
  const [page, setPage] = useState(0);
  const [eventFilter, setEventFilter] = useState("all");

  const { data, isLoading, isFetching, refetch } = useAuthEventsLog({
    event_type: eventFilter === "all" ? undefined : (eventFilter as AuthEventType),
    page,
    pageSize: PAGE_SIZE,
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange = (val: string) => {
    setEventFilter(val);
    setPage(0);
  };

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Eventos de Autenticação
          </p>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {total} total
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={eventFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="h-[28px] text-[11px] w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FILTER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-[28px] px-2 text-[11px]"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Rows */}
      <ScrollArea className="h-[420px]">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando eventos...
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Shield className="w-8 h-8 opacity-20" />
            <p className="text-sm">Nenhum evento encontrado</p>
          </div>
        )}

        {!isLoading && events.map(e => (
          <EventRow key={e.id} event={e} />
        ))}
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-[26px] w-[26px] p-0"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-[26px] w-[26px] p-0"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
