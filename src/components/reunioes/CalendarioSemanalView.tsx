
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendamentoSimple } from "@/hooks/useAgendamentosSimple";
import { GoogleCalendarEvent } from "@/hooks/useGoogleCalendarEvents";
import { cn } from "@/lib/utils";

interface CalendarioSemanalViewProps {
  agendamentos: AgendamentoSimple[];
  usuarios: Array<{ id: string; nome: string; email: string }>;
  onAgendamentoClick: (agendamento: AgendamentoSimple) => void;
  externalEvents?: GoogleCalendarEvent[];
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
}

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

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07h–20h

/** Extrai hora local de uma string ISO (com ou sem offset).
 *  Retorna -1 para eventos de dia inteiro (sem horário ou T00:00:00 sem offset). */
const extractLocalHour = (isoStr: string): number => {
  if (!isoStr.includes("T")) return -1; // "2026-03-07" — dia inteiro
  const timePart = isoStr.split("T")[1]; // ex: "09:00:00-03:00", "13:00:00Z", "00:00:00"
  // Com offset/UTC → converte para hora local real
  if (/[+-]\d{2}:\d{2}$/.test(timePart) || timePart.endsWith("Z")) {
    return new Date(isoStr).getHours();
  }
  const h = parseInt(timePart.split(":")[0]);
  // "T00:00:00" sem offset = evento de dia inteiro gerado pelo edge fn
  if (h === 0 && timePart.startsWith("00:00")) return -1;
  return h;
};

const CalendarioSemanalView = ({
  agendamentos,
  usuarios,
  onAgendamentoClick,
  externalEvents = [],
  currentDate: controlledDate,
  onDateChange,
}: CalendarioSemanalViewProps) => {
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = controlledDate ?? internalDate;

  const setCurrentDate = (d: Date) => {
    setInternalDate(d);
    onDateChange?.(d);
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd   = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const previousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const nextWeek     = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday    = () => setCurrentDate(new Date());

  // Current time line
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowHour   = now.getHours();
  const nowMinute = now.getMinutes();
  const isCurrentWeek = weekDays.some(d => isToday(d));

  const getAgendamentosForDateHour = (date: Date, hour: number) => {
    const dateString = format(date, "yyyy-MM-dd");
    return agendamentos.filter(
      (a) =>
        a.data === dateString &&
        parseInt(a.hora_inicio.split(":")[0]) === hour
    );
  };

  const getExternalEventsForDateHour = (date: Date, hour: number) => {
    const dateString = format(date, "yyyy-MM-dd");
    return externalEvents.filter((e) => {
      if (!e.start.startsWith(dateString)) return false;
      const h = extractLocalHour(e.start);
      if (h === -1) return false; // all-day → renderizado na faixa de dia inteiro
      // eventos fora do range visível aparecem na hora mais próxima
      const clampedH = Math.min(Math.max(h, HOURS[0]), HOURS[HOURS.length - 1]);
      return clampedH === hour;
    });
  };

  /** Eventos de dia inteiro (sem horário) para um dia específico */
  const getAllDayExternalForDate = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return externalEvents.filter((e) => {
      if (!e.start.startsWith(dateString)) return false;
      return extractLocalHour(e.start) === -1;
    });
  };

  return (
    <div className="flex flex-col h-full px-5 py-4 gap-3">

      {/* Nav */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={goToToday}
          className="h-[30px] px-3 text-xs border border-border rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium"
        >
          Hoje
        </button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <button onClick={previousWeek} className="w-7 h-7 flex items-center justify-center rounded-[4px] hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground capitalize w-52 text-center">
          {format(weekStart, "dd MMM", { locale: ptBR })}
          {" – "}
          {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
        </span>
        <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-[4px] hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="overflow-hidden min-w-[640px] rounded-[2px] border border-border bg-card">

          {/* Column headers */}
          <div className="grid grid-cols-8 border-b border-border">
            <div className="py-3 text-center text-[10px] font-medium text-white/40 tracking-widest uppercase border-r border-white/[0.06]" />
            {weekDays.map((day) => {
              const todayDay = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "py-3 text-center border-r border-white/[0.06] last:border-r-0",
                    todayDay && "bg-primary/[0.02]"
                  )}
                >
                  <div className="text-[10px] font-medium text-white/40 tracking-widest uppercase capitalize">
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mx-auto mt-1",
                    todayDay ? "bg-primary text-primary-foreground" : "text-white/55"
                  )}>
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-day events row */}
          {weekDays.some(day => getAllDayExternalForDate(day).length > 0) && (
            <div className="grid grid-cols-8 border-b border-border">
              <div className="py-1.5 text-[9px] text-white/25 border-r border-white/[0.06] flex items-center justify-center font-mono">
                dia
              </div>
              {weekDays.map((day) => {
                const allDay = getAllDayExternalForDate(day);
                return (
                  <div key={`allday-${day.toISOString()}`} className={cn("min-h-[28px] p-0.5 border-r border-white/[0.06] last:border-r-0 space-y-px", isToday(day) && "bg-primary/[0.02]")}>
                    {allDay.map((evt) => (
                      <div
                        key={evt.id}
                        title={evt.title}
                        onClick={() => evt.html_link && window.open(evt.html_link, "_blank")}
                        className="flex items-center gap-1 px-1 py-px rounded-[2px] bg-violet-500/8 hover:bg-violet-500/15 cursor-pointer transition-colors overflow-hidden"
                      >
                        <div className="w-0.5 h-3 rounded-full shrink-0 bg-violet-400" />
                        <div className="text-[9px] text-white/55 leading-3 truncate">{evt.title}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className={cn(
                "grid grid-cols-8 border-b border-white/[0.06] last:border-b-0",
                isCurrentWeek && nowHour === hour && "relative"
              )}
            >
              {/* Current time indicator */}
              {isCurrentWeek && nowHour === hour && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  style={{ top: `${(nowMinute / 60) * 100}%` }}
                >
                  <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 -ml-1" />
                  <div className="h-px bg-rose-500 flex-1 opacity-70" />
                </div>
              )}
              {/* Time label */}
              <div className="py-2 text-[10px] text-white/25 border-r border-white/[0.06] flex items-start justify-center pt-2.5 font-mono">
                {String(hour).padStart(2, "0")}h
              </div>

              {/* Day cells */}
              {weekDays.map((day) => {
                const cellAgendamentos = getAgendamentosForDateHour(day, hour);
                const cellExternal     = getExternalEventsForDateHour(day, hour);
                const todayDay         = isToday(day);

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "min-h-[64px] p-1 border-r border-white/[0.06] last:border-r-0 space-y-0.5",
                      todayDay && "bg-primary/[0.02]"
                    )}
                  >
                    {cellAgendamentos.map((agendamento) => {
                      const isBlocked = agendamento.status === "bloqueio manual";
                      return (
                        <div
                          key={agendamento.id}
                          onClick={() => onAgendamentoClick(agendamento)}
                          className={cn(
                            "flex items-center gap-1 px-1 py-px rounded-[2px] cursor-pointer transition-colors overflow-hidden",
                            statusBg(agendamento.status)
                          )}
                        >
                          <div className={cn("w-0.5 h-3 rounded-full shrink-0", statusBar(agendamento.status))} />
                          {isBlocked
                            ? <Shield className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            : null}
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-medium text-foreground leading-3 truncate">
                              {agendamento.hora_inicio.slice(0, 5)}
                            </div>
                            <div className="text-[9px] text-muted-foreground leading-3 truncate">
                              {isBlocked
                                ? "Bloqueio"
                                : agendamento.negocio?.person?.nome ?? "Cliente"}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {cellExternal.map((evt) => {
                      const timeStr = evt.start.includes("T")
                        ? evt.start.split("T")[1].substring(0, 5)
                        : "";
                      const owner = evt.user_id ? usuarios.find(u => u.id === evt.user_id) : null;
                      const initials = owner
                        ? owner.nome.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                        : null;
                      return (
                        <div
                          key={evt.id}
                          title={`${evt.title}${owner ? ` (${owner.nome})` : ""}`}
                          onClick={() => evt.html_link && window.open(evt.html_link, "_blank")}
                          className="flex items-center gap-1 px-1 py-px rounded-[2px] bg-violet-500/8 hover:bg-violet-500/15 cursor-pointer transition-colors overflow-hidden"
                        >
                          <div className="w-0.5 h-3 rounded-full shrink-0 bg-violet-400" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-0.5">
                              {timeStr && (
                                <span className="text-[10px] font-medium text-white/55 leading-3">{timeStr}</span>
                              )}
                              {initials && (
                                <span className="text-[8px] font-bold text-violet-600 dark:text-violet-400 leading-3 shrink-0">
                                  {initials}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-white/55 leading-3 truncate">{evt.title}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarioSemanalView;
