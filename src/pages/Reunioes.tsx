
import { useState, useEffect, useMemo } from "react";
import { List, Search, Plus, RefreshCw, Edit, X, Shield, CalendarDays, Calendar, ExternalLink, ChevronUp, ChevronDown, AlertCircle, CheckCircle2, WifiOff, Filter, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useAgendamentosSimple, AgendamentoSimple } from "@/hooks/useAgendamentosSimple";
import { useQueryClient } from "@tanstack/react-query";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useTimesWithMethods, useUsuariosDoTenant, useUsuariosTimes } from "@/hooks/useTimes";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import NovaReuniaoWizardModal from "@/components/modals/NovaReuniaoWizardModal";
import BloquearAgendaModal from "@/components/modals/BloquearAgendaModal";
import HorariosUsuarioModalV4 from "@/components/config/horarios/HorariosUsuarioModalV4";
import EditarReuniaoModal from "@/components/modals/EditarReuniaoModal";
import CalendarioView from "@/components/reunioes/CalendarioView";
import CalendarioSemanalView from "@/components/reunioes/CalendarioSemanalView";
import StandardPageLoader from "@/components/loading/StandardPageLoader";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { useGoogleCalendarEvents } from "@/hooks/useGoogleCalendarEvents";
import { useCalendarConnectedUsers } from "@/hooks/useCalendarConnectedUsers";
import { useGoogleCalendarStatus } from "@/hooks/useGoogleCalendarStatus";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "calendar" | "weekly";

const STATUS_CONFIG = [
  { key: "agendado",        label: "Agendada",        dot: "bg-blue-500" },
  { key: "compareceu",      label: "Compareceu",      dot: "bg-emerald-500" },
  { key: "nao_compareceu",  label: "Não compareceu",  dot: "bg-amber-500" },
  { key: "bloqueio manual", label: "Bloqueio",         dot: "bg-muted-foreground/40" },
  { key: "cancelado",       label: "Cancelada",        dot: "bg-rose-500" },
] as const;

const GCAL_SYNC_ERROR_MSG: Record<string, string> = {
  no_calendar_connection: 'Consultor sem Google Calendar conectado',
  token_refresh_failed:   'Token do Google expirou — consultor precisa reconectar',
  no_consultant:          'Sem consultor atribuído à reunião',
};

const STATUS_BADGE: Record<string, string> = {
  agendado:           "text-blue-600 bg-blue-500/8 border-blue-500/20",
  agendada:           "text-blue-600 bg-blue-500/8 border-blue-500/20",
  compareceu:         "text-emerald-600 bg-emerald-500/8 border-emerald-500/20",
  nao_compareceu:     "text-amber-600 bg-amber-500/8 border-amber-500/20",
  "bloqueio manual":  "text-muted-foreground bg-muted border-border",
  cancelado:          "text-rose-600 bg-rose-500/8 border-rose-500/20",
};

const Reunioes = () => {
  const { canChangeFilters, currentUserId, userTimes, isSuperAdmin, isGestor } = useUserPermissions();
  const navigate = useNavigate();
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm]           = useState("");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [dateFilter, setDateFilter]           = useState("all");
  const [currentPage, setCurrentPage]         = useState(1);
  const [activeStatusFilter, setActiveStatusFilter] = useState("");
  const [equipeFilter, setEquipeFilter]       = useState(canChangeFilters ? "all" : (userTimes[0] ?? "all"));
  const [consultorFilter, setConsultorFilter] = useState(canChangeFilters ? "all" : (currentUserId ?? "all"));
  // Calendar view: which user's GCal events to show (admin-only selector; defaults to own)
  const [calendarUserFilter, setCalendarUserFilter] = useState<string>("");
  const [sortField, setSortField]             = useState<"created_at" | "cliente" | "data" | "consultor" | "status">("created_at");
  const [sortDirection, setSortDirection]     = useState<"asc" | "desc">("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [isBloquearModalOpen, setIsBloquearModalOpen] = useState(false);
  const [isMeuHorarioModalOpen, setIsMeuHorarioModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<AgendamentoSimple | null>(null);
  const [retryingSync, setRetryingSync] = useState<string | null>(null);
  const itemsPerPage = 20;

  const gcDateRange = useMemo(() => {
    if (viewMode === "calendar") {
      const s = startOfMonth(calendarCurrentDate);
      const e = endOfMonth(calendarCurrentDate);
      return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
    }
    if (viewMode === "weekly") {
      const s = startOfWeek(calendarCurrentDate, { weekStartsOn: 0 });
      const e = endOfWeek(calendarCurrentDate, { weekStartsOn: 0 });
      return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
    }
    // List view: no GCal fetch needed
    return null;
  }, [viewMode, calendarCurrentDate]);

  // ── Google Calendar sync ──────────────────────────────────────
  // useGoogleCalendarStatus = the reliable hook (already proven in Perfil)
  const { data: myCalStatus } = useGoogleCalendarStatus();
  const isMyCalConnected = !!myCalStatus?.is_active;

  // For admins: get all users who have connected their calendar (RLS-scoped)
  const { data: connectedCalendarUsers = [] } = useCalendarConnectedUsers();

  // Default calendarUserFilter to own id once crmUserId is available
  useEffect(() => {
    if (crmUserId && !calendarUserFilter) setCalendarUserFilter(crmUserId);
  }, [crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Is the currently-selected calendar user's GCal connected?
  const selectedCalUserConnected = useMemo(() => {
    if (!isSuperAdmin && !isGestor) return isMyCalConnected;
    if (calendarUserFilter === "all") return connectedCalendarUsers.length > 0 || isMyCalConnected;
    const selectedId = calendarUserFilter || crmUserId;
    if (!selectedId) return false;
    if (selectedId === crmUserId) return isMyCalConnected;
    return connectedCalendarUsers.some(c => c.user_id === selectedId);
  }, [calendarUserFilter, crmUserId, isMyCalConnected, connectedCalendarUsers, isSuperAdmin, isGestor]);

  const gcUserIds = useMemo(() => {
    if (!crmUserId || viewMode === "list") return [];

    if (isSuperAdmin || isGestor) {
      const connectedIds = new Set(connectedCalendarUsers.map(c => c.user_id));
      if (isMyCalConnected) connectedIds.add(crmUserId);
      // "all" → todos os conectados; individual → só o selecionado
      if (calendarUserFilter === "all") return Array.from(connectedIds);
      const selectedId = calendarUserFilter || crmUserId;
      return connectedIds.has(selectedId) ? [selectedId] : [];
    }

    // Non-admin: always own calendar only, never others'
    return isMyCalConnected ? [crmUserId] : [];
  }, [crmUserId, viewMode, isSuperAdmin, isGestor, connectedCalendarUsers, isMyCalConnected, calendarUserFilter]);

  const {
    data: gcData,
    refetch: refetchExternal,
    isFetching: isSyncingGCal,
  } = useGoogleCalendarEvents({
    userIds: gcUserIds,
    dateStart: gcDateRange?.start ?? "",
    dateEnd: gcDateRange?.end ?? "",
    enabled: gcUserIds.length > 0,
  });

  const externalEvents = gcData?.events ?? [];
  const gcalConnected  = gcData?.connected ?? false;
  const gcalError      = gcData?.error ?? null;
  // ─────────────────────────────────────────────────────────────

  useRealtimeSubscription({ tenantId: "", type: "agendamentos", enabled: true });

  const queryClient = useQueryClient();
  // Para user type: filtrar server-side pelos próprios meetings.
  // Aguarda currentUserId antes de disparar a query para não buscar tudo sem filtro.
  const agendamentosUserId = canChangeFilters ? undefined : currentUserId;
  const agendamentosEnabled = canChangeFilters || !!currentUserId;
  const { data: agendamentos = [], isLoading, refetch } = useAgendamentosSimple(
    agendamentosUserId,
    agendamentosEnabled,
  );

  // Agendamentos para as views de calendário: exclui eventos Google sem lead
  // (eventos pessoais importados do Google Calendar ficam como overlay violeta)
  const calendarAgendamentos = useMemo(
    () => agendamentos.filter(a => a.source !== 'google' || !!a.negocio_id),
    [agendamentos]
  );
  const { usuarios = [] } = useUsuarios();
  const { times } = useTimesWithMethods();
  const { usuarios: usuariosDoTenant } = useUsuariosDoTenant();
  const { data: teamMembers = [] } = useTeamMembers(undefined, equipeFilter !== "all" ? equipeFilter : undefined);

  useEffect(() => {
    if (!canChangeFilters && userTimes.length > 0 && equipeFilter === "all") setEquipeFilter(userTimes[0]);
    if (!canChangeFilters && currentUserId && consultorFilter === "all") setConsultorFilter(currentUserId);
  }, [canChangeFilters, userTimes, currentUserId, equipeFilter, consultorFilter]);

  // Sincroniza Google Calendar → banco e atualiza a lista de agendamentos
  const syncGCal = async () => {
    if (!isMyCalConnected) return;
    try {
      await supabase.functions.invoke('google-cal-sync-to-db');
    } catch {
      // erros são non-fatal — o refetch abaixo sempre ocorre
    }
    await queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
    await refetch();
  };

  useEffect(() => { refetch(); }, [refetch]);
  // Ao entrar em semanal/mensal, dispara sync do GCal → banco automaticamente
  useEffect(() => {
    if (viewMode !== "list") {
      syncGCal();
      refetchExternal();
    } else {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);
  // Para usuários regulares com agenda conectada: sincroniza ao abrir a lista
  useEffect(() => {
    if (!canChangeFilters && isMyCalConnected && viewMode === "list") {
      syncGCal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyCalConnected, canChangeFilters]);
  // Refetch DB meetings ao navegar entre semanas/meses
  useEffect(() => {
    if (viewMode !== "list") refetch();
  }, [calendarCurrentDate, viewMode, refetch]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, dateFilter, activeStatusFilter, equipeFilter, consultorFilter]);

  const filteredUsuarios = equipeFilter === "all" ? usuariosDoTenant : teamMembers;

  // Users eligible for calendar view selector (admin only): all with active GCal
  const calendarEligibleUsers = useMemo(() => {
    if (!isSuperAdmin && !isGestor) return [];
    const connectedIds = new Set(connectedCalendarUsers.map(c => c.user_id));
    if (isMyCalConnected && crmUserId) connectedIds.add(crmUserId);
    return usuariosDoTenant.filter(u => connectedIds.has(u.id));
  }, [connectedCalendarUsers, isMyCalConnected, crmUserId, usuariosDoTenant, isSuperAdmin, isGestor]);

  const statusCounts = useMemo(() => ({
    agendado:          agendamentos.filter(a => a.status === "agendado" || a.status === "agendada").length,
    compareceu:        agendamentos.filter(a => a.status === "compareceu").length,
    nao_compareceu:    agendamentos.filter(a => a.status === "nao_compareceu").length,
    bloqueio_manual:   agendamentos.filter(a => a.status === "bloqueio manual").length,
    cancelado:         agendamentos.filter(a => a.status === "cancelado").length,
  }), [agendamentos]);

  const total = agendamentos.length;
  const countMap: Record<string, number> = {
    agendado: statusCounts.agendado,
    compareceu: statusCounts.compareceu,
    nao_compareceu: statusCounts.nao_compareceu,
    "bloqueio manual": statusCounts.bloqueio_manual,
    cancelado: statusCounts.cancelado,
  };

  const hasQuantidadeData = agendamentos.some(a => a.quantidade != null);
  const hasLocalData      = agendamentos.some(a => a.local?.trim());

  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter(a => {
      const pessoa   = a.negocio?.person;
      const usuario  = usuariosDoTenant.find(u => u.id === a.usuario_id);
      const search   = !searchTerm || [pessoa?.nome, usuario?.nome].some(s => s?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = (s: string, filter: string) =>
        filter === "agendado" ? (s === "agendado" || s === "agendada") : s === filter;
      const status   = activeStatusFilter ? matchStatus(a.status, activeStatusFilter) : (statusFilter === "all" || matchStatus(a.status, statusFilter));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const meetingDate = a.data ? new Date(a.data + "T12:00:00") : null;
      const dateMatch = dateFilter === "all" || !meetingDate ? true
        : dateFilter === "today" ? meetingDate.toDateString() === today.toDateString()
        : dateFilter === "week"  ? (() => {
            const ws = new Date(today); ws.setDate(today.getDate() - today.getDay());
            const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23, 59, 59, 999);
            return meetingDate >= ws && meetingDate <= we;
          })()
        : dateFilter === "month" ? (meetingDate.getMonth() === today.getMonth() && meetingDate.getFullYear() === today.getFullYear())
        : true;
      const consultor = consultorFilter === "all" || a.usuario_id === consultorFilter;
      const equipe    = equipeFilter === "all" || teamMembers.some(m => m.id === a.usuario_id);
      // Regular users (canChangeFilters=false) see all their meetings in list view,
      // including Google-synced ones — they connect their calendar to see everything in one place.
      // Admins/gestors keep the old behavior: list view shows only non-Google meetings.
      const isFromPlatform = !canChangeFilters || viewMode !== "list" || a.source !== "google";
      return search && status && dateMatch && consultor && equipe && isFromPlatform;
    });
  }, [agendamentos, searchTerm, activeStatusFilter, statusFilter, dateFilter, consultorFilter, equipeFilter, usuariosDoTenant, teamMembers, viewMode, canChangeFilters]);

  const sortedAgendamentos = useMemo(() => {
    return [...filteredAgendamentos].sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let av: any, bv: any;
      switch (sortField) {
        case "created_at": av = new Date(a.criado_em || a.created_at || a.data || ""); bv = new Date(b.criado_em || b.created_at || b.data || ""); break;
        case "cliente":    av = a.negocio?.person?.nome ?? ""; bv = b.negocio?.person?.nome ?? ""; break;
        case "data":       av = new Date(a.data); bv = new Date(b.data); break;
        case "consultor":  av = usuariosDoTenant.find(u => u.id === a.usuario_id)?.nome ?? ""; bv = usuariosDoTenant.find(u => u.id === b.usuario_id)?.nome ?? ""; break;
        case "status":     av = a.status ?? ""; bv = b.status ?? ""; break;
        default:           return 0;
      }
      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredAgendamentos, sortField, sortDirection, usuariosDoTenant]);

  const totalPages = Math.ceil(sortedAgendamentos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAgendamentos = sortedAgendamentos.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("asc"); }
    setCurrentPage(1);
  };

  const handleAgendamentoClick = (a: AgendamentoSimple) => { navigate(`/schedule/${a.id}`); };

  const retrySyncToGCal = async (meetingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRetryingSync(meetingId);
    try {
      const { data, error } = await supabase.functions.invoke('public-booking', {
        body: { action: 'gcal_sync', meeting_id: meetingId },
      });
      if (error || data?.success === false) {
        const reason = data?.reason || 'unknown';
        const msg = GCAL_SYNC_ERROR_MSG[reason] || `Falha: ${data?.detail || reason}`;
        toast.error(msg);
      } else {
        toast.success('Sincronizado com Google Calendar');
        queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      }
    } catch {
      toast.error('Erro ao sincronizar com Google Calendar');
    } finally {
      setRetryingSync(null);
    }
  };

  const formatTime = (inicio: string, fim: string) => {
    const extract = (t?: string) => {
      if (!t) return "";
      const part = t.includes("T") ? t.split("T")[1] : t;
      return part.slice(0, 5);
    };
    return `${extract(inicio)}–${extract(fim)}`;
  };
  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = (d.includes("T") ? d.split("T")[0] : d).split("-");
    return new Date(+y, +m - 1, +day).toLocaleDateString("pt-BR");
  };
  const formatCreatedDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const VIEW_TABS = [
    { id: "list"     as ViewMode, label: "Lista",    Icon: List },
    { id: "weekly"   as ViewMode, label: "Semanal",  Icon: CalendarDays },
    { id: "calendar" as ViewMode, label: "Mensal",   Icon: Calendar },
  ] as const;

  const SortTh = ({ field, children, className }: { field: typeof sortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn("text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field
          ? sortDirection === "asc"
            ? <ChevronUp className="w-3 h-3 text-primary" />
            : <ChevronDown className="w-3 h-3 text-primary" />
          : <ChevronUp className="w-3 h-3 opacity-0 group-hover:opacity-40" />}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <StandardPageLoader size="large" message="Carregando reuniões..." />
      </div>
    );
  }

  const hasActiveFilters = activeStatusFilter || statusFilter !== "all" || dateFilter !== "all" || searchTerm || equipeFilter !== "all" || consultorFilter !== "all";
  const advancedFilterCount = [activeStatusFilter, statusFilter !== "all", dateFilter !== "all", equipeFilter !== "all", consultorFilter !== "all"].filter(Boolean).length;
  const clearAllFilters = () => { setActiveStatusFilter(""); setStatusFilter("all"); setDateFilter("all"); setSearchTerm(""); if (canChangeFilters) { setEquipeFilter("all"); setConsultorFilter("all"); } };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Tab bar + actions — same pattern as ProspectPro ─── */}
      <div className="px-6 border-b border-border bg-card dark:bg-zinc-950 shrink-0 flex items-center justify-between h-[45px]">
        {/* Tabs (left) */}
        <div className="flex items-center h-full">
          {VIEW_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={cn(
                "flex items-center gap-1.5 px-4 h-full text-[13px] font-medium transition-colors border-b-2",
                viewMode === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        {/* Actions (right) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {crmUserId && (
            <Button variant="ghost" size="sm" onClick={() => setIsMeuHorarioModalOpen(true)} className="h-[30px] px-2.5 text-xs rounded-[4px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Meu Horário
            </Button>
          )}
          {(isSuperAdmin || isGestor || currentUserId) && (
            <Button variant="ghost" size="sm" onClick={() => setIsBloquearModalOpen(true)} className="h-[30px] px-2.5 text-xs rounded-[4px] text-muted-foreground">
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Bloquear
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={async () => {
            if (viewMode !== "list") {
              await syncGCal();
              await refetchExternal();
            } else {
              await queryClient.invalidateQueries({ queryKey: ["agendamentos-simple"] });
              await refetch();
            }
            toast.success("Atualizado");
          }} disabled={isLoading || isSyncingGCal} className="h-[30px] w-[30px] p-0 text-xs rounded-[4px] text-muted-foreground">
            <RefreshCw className={cn("w-3.5 h-3.5", (isLoading || isSyncingGCal) && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)} className="h-[30px] px-3 text-xs rounded-[4px]">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Reunião
          </Button>
        </div>
      </div>

      {/* ── Google Calendar status bar (calendar/weekly views only) ── */}
      {viewMode !== "list" && (
        <div className={cn(
          "flex items-center justify-between px-5 h-9 border-b border-border shrink-0 text-xs gap-3",
          !selectedCalUserConnected ? "bg-muted" :
          gcalError === "api_disabled" ? "bg-amber-500/5" :
          gcalError ? "bg-rose-500/5" :
          gcalConnected ? "bg-emerald-500/5" :
          "bg-muted"
        )}>
          {/* Left: status message */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {!selectedCalUserConnected && !isSyncingGCal && (
              <>
                <WifiOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Google Agenda não conectada —</span>
                <a href="/schedule/calendario" className="text-primary underline-offset-2 hover:underline shrink-0">conectar aqui</a>
              </>
            )}
            {selectedCalUserConnected && gcalError === "token_expired" && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-amber-700 dark:text-amber-400">Token expirado — reconecte sua conta</span>
                <a href="/schedule/calendario" className="text-primary underline-offset-2 hover:underline shrink-0">Reconectar</a>
              </>
            )}
            {selectedCalUserConnected && gcalError === "api_disabled" && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-amber-700 dark:text-amber-400">Google Calendar API não ativada no Google Cloud Console.</span>
                <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline flex items-center gap-1 shrink-0">
                  Ativar agora <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
            {selectedCalUserConnected && gcalError === "api_error" && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="text-rose-600 dark:text-rose-400">Erro ao buscar Google Agenda — tente sincronizar novamente</span>
              </>
            )}
            {selectedCalUserConnected && !isSyncingGCal && (gcalConnected || gcUserIds.length > 0) && !gcalError && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground">
                  Google Agenda —{" "}
                  <span className="font-medium text-foreground">
                    {externalEvents.length} evento{externalEvents.length !== 1 ? "s" : ""}
                  </span>{" "}
                  neste período
                </span>
              </>
            )}
            {isSyncingGCal && (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando Google Agenda…
              </span>
            )}
          </div>

          {/* Right: user selector (admin only) + sync button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(isSuperAdmin || isGestor) && calendarEligibleUsers.length > 0 && (
              <Select value={calendarUserFilter || crmUserId || ""} onValueChange={setCalendarUserFilter}>
                <SelectTrigger className="h-[26px] w-44 text-xs rounded-[4px] bg-muted border-border py-0">
                  <SelectValue placeholder="Ver agenda de..." />
                </SelectTrigger>
                <SelectContent className="rounded-[4px] text-xs">
                  <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  {calendarEligibleUsers.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.nome}{u.id === crmUserId ? " (você)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isMyCalConnected && (calendarUserFilter === crmUserId || calendarUserFilter === "all") && (
              <button
                onClick={async () => { await syncGCal(); await refetchExternal(); }}
                disabled={isSyncingGCal}
                className="flex items-center gap-1.5 h-6 px-2 rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn("w-3 h-3", isSyncingGCal && "animate-spin")} />
                Sincronizar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── List view: banner de calendário não conectado ── */}
      {viewMode === "list" && !isMyCalConnected && (
        <div className="flex items-center gap-2 px-5 h-8 border-b border-border shrink-0 bg-muted text-xs text-muted-foreground">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Calendário não sincronizado —</span>
          <a href="/schedule/calendario" className="text-primary underline-offset-2 hover:underline">conectar Google Agenda ou Microsoft Teams</a>
        </div>
      )}

      {/* ── Filters (list only) ─────────────────────────────── */}
      {viewMode === "list" && (
        <div className="px-5 py-2 border-b border-border bg-card shrink-0">

          {/* Top row: search + filter toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar cliente ou consultor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-[30px] text-xs rounded-[4px] bg-muted border-transparent focus:border-border focus:bg-background"
              />
            </div>
            <button
              onClick={() => setShowAdvancedFilters(v => !v)}
              className={cn(
                "flex items-center gap-1.5 h-[30px] px-3 rounded-[4px] text-xs border transition-colors shrink-0",
                advancedFilterCount > 0
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {advancedFilterCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tabular-nums">
                  {advancedFilterCount}
                </span>
              )}
              <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvancedFilters && "rotate-180")} />
            </button>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="flex items-center gap-1 h-[30px] px-2.5 rounded-[4px] text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors shrink-0">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>

          {/* Collapsible advanced filters */}
          {showAdvancedFilters && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">

              {/* Status counts (clickable chips) */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STATUS_CONFIG.map(({ key, label, dot }) => {
                    const count  = countMap[key] ?? 0;
                    const active = activeStatusFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveStatusFilter(prev => prev === key ? "" : key)}
                        className={cn(
                          "flex items-center gap-1.5 h-[30px] px-2.5 rounded-[4px] text-xs border transition-colors",
                          active
                            ? "bg-muted border-border text-foreground"
                            : "border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
                        {label}
                        <span className="font-semibold tabular-nums text-white/55">{count}</span>
                      </button>
                    );
                  })}
                  {/* Fine-grain select for non-strip statuses */}
                  <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setActiveStatusFilter(""); }}>
                    <SelectTrigger className="h-[30px] w-auto min-w-[120px] text-xs rounded-[4px] bg-muted border-border">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[4px] text-xs">
                      <SelectItem value="all" className="text-xs">Todos</SelectItem>
                      <SelectItem value="agendado" className="text-xs">Agendada</SelectItem>
                      <SelectItem value="compareceu" className="text-xs">Compareceu</SelectItem>
                      <SelectItem value="nao_compareceu" className="text-xs">Não compareceu</SelectItem>
                      <SelectItem value="bloqueio manual" className="text-xs">Bloqueio</SelectItem>
                      <SelectItem value="cancelado" className="text-xs">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date + Equipe + Consultor */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Período e equipe</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="h-[30px] w-40 text-xs rounded-[4px] bg-muted border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-[4px] text-xs">
                      <SelectItem value="all" className="text-xs">Todas as datas</SelectItem>
                      <SelectItem value="today" className="text-xs">Hoje</SelectItem>
                      <SelectItem value="week" className="text-xs">Esta semana</SelectItem>
                      <SelectItem value="month" className="text-xs">Este mês</SelectItem>
                    </SelectContent>
                  </Select>

                  {canChangeFilters && (
                    <Select value={equipeFilter} onValueChange={v => { setEquipeFilter(v); setConsultorFilter("all"); }}>
                      <SelectTrigger className="h-[30px] w-36 text-xs rounded-[4px] bg-muted border-border">
                        <SelectValue placeholder="Equipe" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[4px]">
                        <SelectItem value="all" className="text-xs">Todas as equipes</SelectItem>
                        {times.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {canChangeFilters && (
                    <Select value={consultorFilter} onValueChange={setConsultorFilter}>
                      <SelectTrigger className="h-[30px] w-36 text-xs rounded-[4px] bg-muted border-border">
                        <SelectValue placeholder="Consultor" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[4px]">
                        <SelectItem value="all" className="text-xs">Todos</SelectItem>
                        {filteredUsuarios.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] text-muted-foreground">Ativos:</span>
              {[
                activeStatusFilter && { label: activeStatusFilter, clear: () => setActiveStatusFilter("") },
                statusFilter !== "all" && { label: statusFilter, clear: () => setStatusFilter("all") },
                dateFilter !== "all" && { label: dateFilter === "today" ? "Hoje" : dateFilter === "week" ? "Esta semana" : "Este mês", clear: () => setDateFilter("all") },
                searchTerm && { label: `"${searchTerm}"`, clear: () => setSearchTerm("") },
                equipeFilter !== "all" && canChangeFilters && { label: times.find(t => t.id === equipeFilter)?.nome ?? equipeFilter, clear: () => setEquipeFilter("all") },
                consultorFilter !== "all" && canChangeFilters && { label: filteredUsuarios.find(u => u.id === consultorFilter)?.nome ?? consultorFilter, clear: () => setConsultorFilter("all") },
              ].filter((p): p is { label: string; clear: () => void } => Boolean(p)).map((pill, i) => (
                <span key={i} className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-muted text-[10px] text-foreground">
                  {pill.label}
                  <X className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground cursor-pointer" onClick={pill.clear} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KPI Strip (list view only) ───────────────────────── */}
      {viewMode === "list" && total > 0 && (isMyCalConnected || canChangeFilters) && (
        <div className="flex items-stretch shrink-0 border-b border-border">
          {(() => {
            const realizadas = statusCounts.compareceu;
            const finalizadas = statusCounts.compareceu + statusCounts.nao_compareceu;
            const showRate = finalizadas > 0 ? Math.round((realizadas / finalizadas) * 100) : null;
            return [
              { label: "Total de reuniões", value: total,                        color: "text-foreground" },
              { label: "Agendadas",          value: statusCounts.agendado,        color: "text-blue-600 dark:text-blue-400" },
              { label: "Compareceram",       value: statusCounts.compareceu,      color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Não compareceu",     value: statusCounts.nao_compareceu,  color: "text-amber-600 dark:text-amber-400" },
              { label: "Show Rate",          value: showRate != null ? `${showRate}%` : "—", color: "text-foreground" },
            ].map(({ label, value, color }, i) => (
              <div key={label} className={cn("bg-card flex flex-col flex-1 px-5 py-2.5", i > 0 && "border-l border-border")}>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-none mb-1">{label}</span>
                <span className={cn("text-xl font-bold tabular-nums leading-none", color)}>{value}</span>
              </div>
            ));
          })()}
        </div>
      )}

      {/* ── Main content ────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* Weekly */}
        {viewMode === "weekly" && (
          <div className="h-full">
            <CalendarioSemanalView agendamentos={calendarAgendamentos} usuarios={usuariosDoTenant} onAgendamentoClick={handleAgendamentoClick} externalEvents={externalEvents} currentDate={calendarCurrentDate} onDateChange={setCalendarCurrentDate} />
          </div>
        )}

        {/* Monthly */}
        {viewMode === "calendar" && (
          <div className="h-full">
            <CalendarioView agendamentos={calendarAgendamentos} usuarios={usuariosDoTenant} onAgendamentoClick={handleAgendamentoClick} externalEvents={externalEvents} currentDate={calendarCurrentDate} onDateChange={setCalendarCurrentDate} />
          </div>
        )}

        {/* List */}
        {viewMode === "list" && (
          <div className="h-full overflow-auto">
            {paginatedAgendamentos.length > 0 ? (
              <div className="mx-5 mt-4 mb-6 rounded-[2px] border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <SortTh field="created_at" className="pl-4">Criado em</SortTh>
                      <SortTh field="cliente">Cliente</SortTh>
                      <SortTh field="data">Data</SortTh>
                      <TableHead className="text-xs font-medium text-muted-foreground">Horário</TableHead>
                      <SortTh field="consultor">Consultor</SortTh>
                      <SortTh field="status">Status</SortTh>
                      <TableHead className="text-xs font-medium text-muted-foreground">Negócio</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground text-right" title="Lead score (pessoa)">Lead</TableHead>
                      {hasQuantidadeData && <TableHead className="text-xs font-medium text-muted-foreground">Qtd</TableHead>}
                      {hasLocalData && <TableHead className="text-xs font-medium text-muted-foreground">Local</TableHead>}
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAgendamentos.map(a => {
                      const pessoa    = a.negocio?.person;
                      const usuario   = usuariosDoTenant.find(u => u.id === a.usuario_id);
                      const isBlocked = a.status === "bloqueio manual";
                      const badgeCls  = STATUS_BADGE[a.status] ?? "text-muted-foreground bg-muted border-border";
                      const isSyncFailed = !isBlocked && !a.google_event_id && (a.gcal_sync_error || a.source === 'public_booking');

                      return (
                        <TableRow key={a.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted transition-colors" onClick={() => handleAgendamentoClick(a)}>
                          <TableCell className="pl-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatCreatedDate(a.criado_em)}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground max-w-[180px]">
                            {isBlocked
                              ? <span className="flex items-center gap-1.5 text-muted-foreground"><Shield className="w-3.5 h-3.5 text-slate-400" />Bloqueio</span>
                              : <span className="truncate block">{pessoa?.nome ?? "—"}</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.data)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">{formatTime(a.hora_inicio, a.hora_fim)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5 max-w-[160px]">
                              {(a.consultor?.nome ?? usuario?.nome) && (
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shrink-0 leading-none">
                                  {(a.consultor?.nome ?? usuario?.nome ?? "").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="truncate">{a.consultor?.nome ?? usuario?.nome ?? "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium border", badgeCls)}>
                                {a.status}
                              </span>
                              {isSyncFailed && (
                                <span className="relative group/sync flex items-center gap-0.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  <button
                                    onClick={(e) => retrySyncToGCal(a.id, e)}
                                    disabled={retryingSync === a.id}
                                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted transition-colors"
                                    title="Tentar sincronizar novamente"
                                  >
                                    <RefreshCw className={cn("w-3 h-3 text-muted-foreground", retryingSync === a.id && "animate-spin")} />
                                  </button>
                                  <span className="absolute left-0 top-full mt-1 z-50 hidden group-hover/sync:block bg-popover border border-border rounded-[4px] px-2 py-1.5 text-[10px] text-popover-foreground whitespace-nowrap">
                                    {a.gcal_sync_error
                                      ? (GCAL_SYNC_ERROR_MSG[a.gcal_sync_error] || `Erro: ${a.gcal_sync_error}`)
                                      : 'Google Calendar não sincronizado'}
                                  </span>
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {isBlocked ? "—" : a.negocio?.id
                              ? <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={e => { e.stopPropagation(); navigate(`/crm/kanban/${a.negocio!.id}`); }}>
                                  <ExternalLink className="w-3 h-3" />Ver
                                </button>
                              : <span>—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-right pr-2">
                            {!isBlocked && pessoa?.score != null
                              ? <span className="font-medium text-foreground tabular-nums">{pessoa.score}</span>
                              : <span className="text-white/40">—</span>}
                          </TableCell>
                          {hasQuantidadeData && (
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {a.quantidade ?? "—"}
                            </TableCell>
                          )}
                          {hasLocalData && (
                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                              {a.local ?? "—"}
                            </TableCell>
                          )}
                          <TableCell className="pr-3">
                            <Button size="sm" variant="ghost" className="h-[30px] w-[30px] p-0 rounded-[4px] opacity-0 group-hover:opacity-100 hover:bg-muted" onClick={e => { e.stopPropagation(); handleAgendamentoClick(a); }}>
                              <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {startIndex + 1}–{Math.min(startIndex + itemsPerPage, sortedAgendamentos.length)} de {sortedAgendamentos.length}
                    </span>
                    <Pagination>
                      <PaginationContent className="gap-0.5">
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className={cn("h-[30px] text-xs rounded-[4px]", currentPage === 1 && "pointer-events-none opacity-40")} />
                        </PaginationItem>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          const p = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                          return (
                            <PaginationItem key={p}>
                              <Button variant={currentPage === p ? "outline" : "ghost"} size="sm" onClick={() => setCurrentPage(p)} className="h-[30px] w-[30px] p-0 text-xs rounded-[4px]">{p}</Button>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className={cn("h-[30px] text-xs rounded-[4px]", currentPage === totalPages && "pointer-events-none opacity-40")} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <Calendar className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">
                  {total > 0 ? "Nenhuma reunião corresponde aos filtros" : "Ainda não há reuniões agendadas"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {total > 0
                    ? "Ajuste ou limpe os filtros para ver outras reuniões."
                    : "Crie a primeira reunião para começar a usar o Schedule PRO."}
                </p>
                {total > 0 ? (
                  <Button variant="outline" size="sm" onClick={clearAllFilters} className="rounded-[4px] h-[30px] text-xs mt-1">
                    <X className="w-3.5 h-3.5 mr-1.5" />Limpar filtros
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setIsModalOpen(true)} className="rounded-[4px] h-[30px] text-xs mt-1">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Nova Reunião
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <NovaReuniaoWizardModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      <BloquearAgendaModal open={isBloquearModalOpen} onClose={() => setIsBloquearModalOpen(false)} />

      <HorariosUsuarioModalV4
        open={isMeuHorarioModalOpen}
        onOpenChange={setIsMeuHorarioModalOpen}
        usuario={crmUserId ? { id: crmUserId, nome: user?.profile?.nome || '', email: user?.profile?.email || '' } : null}
      />
      <EditarReuniaoModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} agendamento={selectedAgendamento || undefined} />
    </div>
  );
};

export default Reunioes;
