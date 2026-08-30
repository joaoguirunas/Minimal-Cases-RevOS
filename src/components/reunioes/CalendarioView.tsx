
import { useState } from "react";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoSimple } from "@/hooks/useAgendamentosSimple";
import { GoogleCalendarEvent } from "@/hooks/useGoogleCalendarEvents";
import { cn } from "@/lib/utils";

interface CalendarioViewProps {
  agendamentos: AgendamentoSimple[];
  usuarios: Array<{ id: string; nome: string; email: string }>;
  onAgendamentoClick: (agendamento: AgendamentoSimple) => void;
  externalEvents?: GoogleCalendarEvent[];
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_LEGEND = [
  { label: "Agendada",        bar: "bg-blue-500" },
  { label: "Compareceu",      bar: "bg-emerald-500" },
  { label: "Não compareceu",  bar: "bg-amber-500" },
  { label: "Bloqueio",        bar: "bg-slate-400" },
  { label: "Cancelada",       bar: "bg-rose-500" },
];

const statusBar = (status: string) => {
  switch (status) {
    case "agendado":
    case "agendada":        return "bg-blue-500";
    case "compareceu":      return "bg-emerald-500";
    case "nao_compareceu":  return "bg-amber-500";
    case "bloqueio manual": return "bg-slate-400";
    case "cancelado":       return "bg-rose-500";
    default:                return "bg-muted-foreground";
  }
};

const statusBg = (status: string) => {
  switch (status) {
    case "agendado":
    case "agendada":        return "bg-blue-500/6 hover:bg-blue-500/12";
    case "compareceu":      return "bg-emerald-500/6 hover:bg-emerald-500/12";
    case "nao_compareceu":  return "bg-amber-500/6 hover:bg-amber-500/12";
    case "bloqueio manual": return "bg-muted hover:bg-muted";
    case "cancelado":       return "bg-rose-500/6 hover:bg-rose-500/12";
    default:                return "bg-muted hover:bg-muted";
  }
};

const CalendarioView = ({ agendamentos, usuarios, onAgendamentoClick, externalEvents = [], currentDate: controlledDate, onDateChange }: CalendarioViewProps) => {
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = controlledDate ?? internalDate;

  const setCurrentDate = (d: Date) => {
    setInternalDate(d);
    onDateChange?.(d);
  };

  const monthStart  = startOfMonth(currentDate);
  const monthEnd    = endOfMonth(currentDate);
  const monthDays   = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = getDay(monthStart);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getMeetingsForDate = (date: Date) => {
    const d = format(date, "yyyy-MM-dd");
    return agendamentos.filter(a => a.data === d);
  };
  const getExternalForDate = (date: Date) => {
    const d = format(date, "yyyy-MM-dd");
    return externalEvents.filter(e => e.start.startsWith(d));
  };

  return (
    <div className="flex flex-col h-full px-5 py-4 gap-3">

      {/* Nav */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setCurrentDate(new Date())}
          className="h-[30px] px-3 text-xs border border-border rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium"
        >
          Hoje
        </button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-[4px] hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground capitalize w-40 text-center">
          {format(currentDate, "MMMM yyyy", { locale: ptBR })}
        </span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-[4px] hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        {/* Inline legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {STATUS_LEGEND.map(({ label, bar }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", bar)} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
          {externalEvents.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="text-[10px] text-muted-foreground">Google</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="rounded-[2px] border border-border overflow-hidden bg-card min-w-[540px]">

          {/* Header row */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] font-medium text-white/40 tracking-widest uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[110px] border-b border-r border-white/[0.06]" />
            ))}

            {monthDays.map((day, idx) => {
              const meetings  = getMeetingsForDate(day);
              const external  = getExternalForDate(day);
              const isNow     = isToday(day);
              const col       = (startOffset + idx) % 7;
              const isLast    = col === 6;
              const isWeekend = col === 0 || col === 6;
              const total     = meetings.length + external.length;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[110px] p-2 border-b border-white/[0.06]",
                    !isLast && "border-r border-white/[0.06]",
                    isNow && "bg-primary/[0.025]",
                    isWeekend && !isNow && "bg-muted"
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-semibold mb-1.5",
                    isNow ? "bg-primary text-primary-foreground" : isWeekend ? "text-white/40" : "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </div>

                  {/* Events */}
                  <div className="space-y-px">
                    {meetings.slice(0, 3).map(a => {
                      const blocked = a.status === "bloqueio manual";
                      return (
                        <div
                          key={a.id}
                          onClick={() => onAgendamentoClick(a)}
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-px rounded-[2px] cursor-pointer transition-colors overflow-hidden",
                            statusBg(a.status)
                          )}
                        >
                          <div className={cn("w-0.5 h-3 rounded-full shrink-0", statusBar(a.status))} />
                          {blocked
                            ? <Shield className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            : null}
                          <span className="text-[10px] truncate text-foreground leading-4">
                            {a.hora_inicio?.slice(0, 5)}{" "}
                            {blocked ? "Bloqueio" : a.negocio?.person?.nome ?? "Cliente"}
                          </span>
                        </div>
                      );
                    })}

                    {external.slice(0, Math.max(0, 3 - meetings.length)).map(evt => {
                      const t = evt.start.includes("T") ? evt.start.split("T")[1].substring(0, 5) : "";
                      const owner = evt.user_id ? usuarios.find(u => u.id === evt.user_id) : null;
                      const initials = owner
                        ? owner.nome.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                        : null;
                      return (
                        <div
                          key={evt.id}
                          title={`${evt.title}${owner ? ` (${owner.nome})` : ""}`}
                          onClick={() => evt.html_link && window.open(evt.html_link, "_blank")}
                          className="flex items-center gap-1 px-1.5 py-px rounded-[2px] bg-violet-500/8 hover:bg-violet-500/15 cursor-pointer transition-colors overflow-hidden"
                        >
                          <div className="w-0.5 h-3 rounded-full shrink-0 bg-violet-400" />
                          {initials && (
                            <span className="text-[8px] font-bold text-violet-600 dark:text-violet-400 shrink-0 leading-none">
                              {initials}
                            </span>
                          )}
                          <span className="text-[10px] truncate text-white/55 leading-4">
                            {t && `${t} `}{evt.title}
                          </span>
                        </div>
                      );
                    })}

                    {total > 3 && (
                      <div className="text-[9px] text-white/40 pl-2 leading-4">+{total - 3}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};

export default CalendarioView;
