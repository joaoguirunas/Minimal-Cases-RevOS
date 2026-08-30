import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, User, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgendamentosSimple } from "@/hooks/useAgendamentosSimple";
import NovaReuniaoWizardModal from "@/components/modals/NovaReuniaoWizardModal";

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  agendado:          "text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20",
  agendada:          "text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20",
  compareceu:        "text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20",
  nao_compareceu:    "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20",
  "bloqueio manual": "text-muted-foreground bg-muted border-border",
  cancelado:         "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20",
  cancelada:         "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20",
};

const STATUS_LABEL: Record<string, string> = {
  agendado:          "Agendada",
  agendada:          "Agendada",
  compareceu:        "Compareceu",
  nao_compareceu:    "Não compareceu",
  "bloqueio manual": "Bloqueio",
  cancelado:         "Cancelada",
  cancelada:         "Cancelada",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(isoString: string) {
  const d = new Date(isoString);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NegocioReunioesProps {
  negocioId: string;
  clientName?: string;
  leadValue?: number;
}

const NegocioReunioes = ({ negocioId, clientName, leadValue }: NegocioReunioesProps) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const { data: allMeetings = [], isLoading } = useAgendamentosSimple();

  const meetings = allMeetings
    .filter((m) => m.lead_id === negocioId || m.negocio_id === negocioId)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const initialLead = { id: negocioId, clientName: clientName || "Cliente", value: leadValue };

  if (isLoading) {
    return (
      <div className="p-5 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-[2px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Reuniões{meetings.length > 0 && ` (${meetings.length})`}
        </p>
        <Button size="sm" onClick={() => setShowModal(true)} className="h-[30px] px-3 text-xs gap-1.5 rounded-[4px]">
          <Plus className="w-3.5 h-3.5" />
          Agendar reunião
        </Button>
      </div>

      {/* Empty state */}
      {meetings.length === 0 ? (
        <div className="border border-dashed border-border rounded-[2px] py-10 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground/60 mb-1">Nenhuma reunião agendada</p>
          <p className="text-[12px] text-muted-foreground/40">
            Agende uma reunião para manter contato direto
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowModal(true)}
            className="mt-4 h-[30px] px-3 text-xs gap-1.5 rounded-[4px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Agendar reunião
          </Button>
        </div>
      ) : (
        /* Meeting list */
        <div className="space-y-1.5">
          {meetings.map((meeting) => {
            const { date, time } = formatDateTime(meeting.start_time);
            const duration = formatDuration(meeting.start_time, meeting.end_time);
            const status = (meeting.status ?? "agendado").toLowerCase();
            const badgeClass = STATUS_BADGE[status] ?? "text-muted-foreground bg-muted border-border";
            const statusLabel = STATUS_LABEL[status] ?? meeting.status;
            const [day, month] = date.split(" ");

            return (
              <button
                key={meeting.id}
                type="button"
                onClick={() => navigate(`/schedule/${meeting.id}`)}
                className="w-full text-left border border-border rounded-[2px] bg-card hover:bg-white/[0.035] hover:border-white/[0.10] transition-all duration-300 px-4 py-3 flex items-center gap-4 group"
              >
                {/* Date block */}
                <div className="flex-shrink-0 w-9 text-center">
                  <p className="text-[15px] font-semibold leading-tight text-foreground">{day}</p>
                  <p className="text-[11px] text-muted-foreground/50 capitalize leading-tight">{month}</p>
                </div>

                {/* Separator */}
                <div className="w-px h-8 bg-border/50 flex-shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-foreground">{time}</span>
                    <span className="text-[11px] text-muted-foreground/40">·</span>
                    <span className="text-[12px] text-muted-foreground/60">{duration}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-muted-foreground/50">
                    {meeting.consultor && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {meeting.consultor.nome}
                      </span>
                    )}
                    {meeting.location && (
                      <span className="flex items-center gap-1 truncate max-w-[140px]">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{meeting.location}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Status + chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium border leading-none",
                      badgeClass,
                    )}
                  >
                    {statusLabel}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <NovaReuniaoWizardModal
        open={showModal}
        onOpenChange={setShowModal}
        initialLead={initialLead}
      />
    </div>
  );
};

export default NegocioReunioes;
