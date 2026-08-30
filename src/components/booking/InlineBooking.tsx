import { useState, useEffect } from "react";
import { format, addDays, isSameDay, isToday, startOfToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

interface Slot {
  date: string;
  start_time: string;
  end_time: string;
}

interface SessionData {
  // has_email: lead já tem email salvo? Ausente/undefined → tratado como false
  // (mostra o input opcional) por degradação segura.
  person: { id: string; name: string; email: string | null; has_email?: boolean };
  slots: Slot[];
}

interface InlineBookingProps {
  leadId: string;
  ruleSetId: string;
  duration?: number;
  accentColor?: string;
  /** WhatsApp template name to send after booking (with meeting link) */
  waConfirmTemplate?: string;
  onBooked?: (meetingId: string) => void;
  /** Called when internal step changes (1=calendar, 2=confirmed) */
  onStepChange?: (step: 1 | 2) => void;
  /** Inherited style context from parent form — adapts to any skin/theme */
  bodyColor?: string;
  labelColor?: string;
  cardBg?: string;
  inputBg?: string;
  borderColor?: string;
  isDark?: boolean;
  fontFamily?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFirstName(name: string) {
  return name.split(" ")[0];
}

function groupSlotsByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
}

// Validação de formato de email (defesa em profundidade — o servidor revalida).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

// Retorno da RPC set_booking_lead_email (ainda não no types.ts gerado).
interface SetEmailResult {
  ok?: boolean;
  people_id?: string;
  skipped?: string;
  error?: string;
}

// Assinatura mínima da RPC, tipada localmente porque set_booking_lead_email
// ainda não está no types.ts gerado. Evita o `any` do client cast; basta
// regenerar os types após o apply para remover este wrapper.
type LeadEmailRpc = (
  fn: "set_booking_lead_email",
  args: { p_lead_id: string; p_email: string }
) => Promise<{ data: SetEmailResult | null }>;

// Persiste o email do lead via RPC SECURITY DEFINER, escopada ao lead do link.
async function setBookingLeadEmail(leadId: string, email: string): Promise<SetEmailResult> {
  const rpc = supabase.rpc as unknown as LeadEmailRpc;
  const { data } = await rpc("set_booking_lead_email", { p_lead_id: leadId, p_email: email });
  return data ?? {};
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InlineBooking({
  leadId,
  ruleSetId,
  duration = 30,
  accentColor,
  waConfirmTemplate,
  onBooked,
  onStepChange,
  bodyColor,
  labelColor,
  cardBg,
  inputBg,
  borderColor,
  isDark,
  fontFamily,
}: InlineBookingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [calWeekStart, setCalWeekStart] = useState<Date>(startOfToday());

  const [confirming, setConfirming] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [confirmedConsultor, setConfirmedConsultor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Email opcional: só pedido quando o lead não tem email salvo. Vazio = pular.
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  // Aviso NÃO-bloqueante (AC9c): RPC rejeitou o email após passar na regex local.
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await (supabase as any).rpc(
          "get_booking_session",
          {
            p_lead_id: leadId,
            p_rule_set_id: ruleSetId ?? null,
            p_duration: duration,
            p_days_ahead: 14,
          }
        );
        if (rpcErr) throw new Error(rpcErr.message);
        if (data?.error) throw new Error(data.error);
        setSession(data as SessionData);
      } catch (e: any) {
        setError(e.message || "Erro ao carregar horários");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [leadId, ruleSetId, duration]);

  // Pré-seleciona o 1º dia com horários quando a session carrega — sem isso o
  // lead precisa clicar num dia antes de ver qualquer horário (mirrors
  // AgendamentoPublico.tsx, que já tinha esse comportamento).
  useEffect(() => {
    if (!session) return;
    const firstDate = session.slots[0]?.date;
    if (!firstDate) return;
    const day = new Date(`${firstDate}T12:00:00`);
    setSelectedDate(day);
    setCalWeekStart(startOfDay(day));
  }, [session]);

  // Lead sem email salvo → input opcional. has_email ausente é tratado como
  // false (degradação segura — campo opcional não trava ninguém).
  const needsEmail = !session?.person.has_email;
  const trimmedEmail = email.trim();

  const confirm = async () => {
    if (!session || !selectedSlot) return;
    setConfirming(true);
    setError(null);
    setEmailError(null);
    setEmailWarning(null);
    try {
      // Coleta opcional de email (AGENDA-GCAL-03): só quando o lead não tem email
      // e digitou algo. Vazio = pular. Persiste ANTES do booking — o gcal_sync lê
      // clients_people.email server-side.
      if (needsEmail && trimmedEmail) {
        // AC3: formato inválido pela regex local bloqueia até corrigir ou limpar.
        if (!isValidEmail(trimmedEmail)) {
          setEmailError("Informe um email válido ou deixe o campo em branco.");
          setConfirming(false);
          return;
        }
        const emailRes = await setBookingLeadEmail(leadId, trimmedEmail);
        // AC9c: passou na regex local mas a RPC rejeitou → NÃO bloqueia; o booking
        // segue, só avisa que o convite não virá. ok/skipped = sucesso silencioso.
        if (emailRes.error === "invalid_email") {
          setEmailWarning("O email parece inválido — você não receberá o convite no calendário.");
        }
      }

      const toISO = (d: string, t: string) =>
        new Date(`${d}T${t}:00`).toISOString();

      const { data, error: rpcErr } = await (supabase as any).rpc(
        "book_meeting",
        {
          p_lead_id: leadId,
          p_start_time: toISO(selectedSlot.date, selectedSlot.start_time),
          p_end_time: toISO(selectedSlot.date, selectedSlot.end_time),
          p_rule_set_id: ruleSetId ?? null,
          p_duration: duration,
          p_notes: null,
        }
      );

      if (rpcErr) throw new Error(rpcErr.message);
      if (data?.error) throw new Error(data.error);

      setMeetingId(data.meeting_id);
      setConfirmedConsultor(data.consultor ?? null);
      setStep(2);
      onStepChange?.(2);
      onBooked?.(data.meeting_id);

      // Issue short-lived single-use action tokens (SCH-H-1), then fire side-effects.
      // gcal_sync and wa_confirm both require a capability_token — without it the edge
      // function returns 401 before doing anything. Mirrors AgendamentoPublico.tsx.
      supabase.functions
        .invoke("public-booking", {
          body: { action: "issue_tokens", meeting_id: data.meeting_id },
        })
        .then(({ data: tokensData, error: tokensErr }) => {
          if (tokensErr || !tokensData) {
            console.warn("[issue_tokens] failed:", tokensErr);
            return;
          }
          const { gcal_sync_token, wa_confirm_token } = tokensData as {
            gcal_sync_token: string;
            wa_confirm_token: string;
          };

          // Push to Google Calendar, then send WA confirmation (needs the Meet link).
          supabase.functions
            .invoke("public-booking", {
              body: {
                action: "gcal_sync",
                meeting_id: data.meeting_id,
                capability_token: gcal_sync_token,
              },
            })
            .then(() => {
              if (waConfirmTemplate) {
                supabase.functions
                  .invoke("public-booking", {
                    body: {
                      action: "wa_confirm",
                      meeting_id: data.meeting_id,
                      capability_token: wa_confirm_token,
                      template_name: waConfirmTemplate,
                    },
                  })
                  .catch(() => {});
              }
            })
            .catch(() => {});
        })
        .catch((err) => {
          console.warn("[issue_tokens] unexpected error:", err);
        });
    } catch (e: any) {
      setError(e.message || "Erro ao confirmar");
    } finally {
      setConfirming(false);
    }
  };

  const slotsByDate = session ? groupSlotsByDate(session.slots) : {};
  const calDays = Array.from({ length: 7 }, (_, i) =>
    addDays(calWeekStart, i)
  );
  const slotsForDate = selectedDate
    ? slotsByDate[format(selectedDate, "yyyy-MM-dd")] || []
    : [];

  const accent = accentColor || "#4f46e5";

  // ── Resolved theme colors ──
  // Mirrors AgendamentoPublico visual language, adapted for any skin.
  // card = inner calendar cards (uses inputBg for contrast vs parent).
  const t = {
    body: bodyColor ?? "#111827",
    label: labelColor ?? "#6b7280",
    muted: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af",
    mutedFaint: isDark ? "rgba(255,255,255,0.18)" : "#9ca3af80",
    card: inputBg ?? (isDark ? "#18181b" : "#fff"),
    input: inputBg ?? (isDark ? "#18181b" : "#fff"),
    // Subtle card borders (like border-border/50 in AgendamentoPublico)
    cardBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    // Separator borders inside cards (like border-border/40)
    sepBorder: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
    // Slot button borders (like border-border/60 — not heavy)
    slotBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    slotHoverBorder: accent + "60",
    slotHoverBg: accent + "0A",
    pillBg: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6",
    pillText: isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
    font: fontFamily,
    disabledText: isDark ? "rgba(255,255,255,0.15)" : "#d1d5db",
    disabledBg: isDark ? "rgba(255,255,255,0.04)" : "#f9fafb",
    successBg: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
    successRing: isDark ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.06)",
    errorBg: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2",
    errorBorder: isDark ? "rgba(239,68,68,0.2)" : "#fecaca",
  };

  // ── Loading (skeleton — matches AgendamentoPublico) ──
  if (loading) {
    return (
      <div className="space-y-4 w-full" style={{ fontFamily: t.font }}>
        <div className="rounded-[2px] animate-pulse" style={{ height: 80, background: t.pillBg }} />
        <div className="rounded-[2px] animate-pulse" style={{ height: 160, background: t.pillBg, opacity: 0.7 }} />
        <div className="rounded-[2px] animate-pulse" style={{ height: 48, background: t.pillBg, opacity: 0.5 }} />
      </div>
    );
  }

  // ── Error ──
  if (error && !session) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-[2px] text-sm"
        style={{
          background: t.errorBg,
          border: `1px solid ${t.errorBorder}`,
          color: isDark ? "#fca5a5" : "#b91c1c",
          fontFamily: t.font,
        }}>
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  // ── Step 2: Confirmed (mirrors AgendamentoPublico Step 2) ──
  if (step === 2 && session && selectedSlot) {
    return (
      <div className="space-y-5 w-full" style={{ fontFamily: t.font }}>
        {/* Success hero card */}
        <div
          className="rounded-[2px] px-6 py-8 text-center space-y-3"
          style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: t.successBg, boxShadow: `0 0 0 4px ${t.successRing}` }}
            >
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: t.body }}>Reunião confirmada!</p>
            <p className="text-sm mt-1" style={{ color: t.label }}>
              {getFirstName(session.person.name)}, você receberá uma confirmação em breve.
            </p>
          </div>
        </div>

        {/* Aviso não-bloqueante (AC9c): email rejeitado pela RPC — reunião
            confirmada, mas o convite no calendário não será enviado. */}
        {emailWarning && (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-[2px] text-sm"
            style={{
              background: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",
              border: `1px solid ${isDark ? "rgba(245,158,11,0.2)" : "#fde68a"}`,
              color: isDark ? "#fcd34d" : "#92400e",
            }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{emailWarning}</span>
          </div>
        )}

        {/* Meeting details card */}
        <div
          className="rounded-[2px] overflow-hidden"
          style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          {confirmedConsultor && (
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${t.sepBorder}` }}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: accent + "15", color: accent, boxShadow: `0 0 0 2px ${accent}20` }}
              >
                {confirmedConsultor.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: t.muted }}>Seu consultor</p>
                <p className="text-sm font-bold" style={{ color: t.body }}>{confirmedConsultor.name}</p>
              </div>
            </div>
          )}

          <div className="px-5 py-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[2px] flex items-center justify-center shrink-0" style={{ background: t.pillBg }}>
                <Calendar className="w-4 h-4" style={{ color: t.pillText }} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: t.muted }}>Data</p>
                <p className="text-sm font-semibold capitalize mt-0.5" style={{ color: t.body }}>
                  {format(new Date(selectedSlot.date + "T12:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[2px] flex items-center justify-center shrink-0" style={{ background: t.pillBg }}>
                <Clock className="w-4 h-4" style={{ color: t.pillText }} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: t.muted }}>Horário</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: t.body }}>
                  {selectedSlot.start_time} — {selectedSlot.end_time}
                  <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: t.pillBg, color: t.pillText }}>
                    {duration} min
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {meetingId && (
          <p className="text-center text-[11px]" style={{ color: t.mutedFaint }}>
            Protocolo:{" "}
            <code className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: t.pillBg }}>
              {meetingId.slice(0, 8).toUpperCase()}
            </code>
          </p>
        )}
      </div>
    );
  }

  if (!session) return null;

  // ── Step 1: Calendar + slots (mirrors AgendamentoPublico layout) ──
  return (
    <div className="space-y-5 w-full" style={{ textAlign: "left", fontFamily: t.font }}>
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-[2px] text-xs"
          style={{ background: t.errorBg, border: `1px solid ${t.errorBorder}`, color: isDark ? "#fca5a5" : "#b91c1c" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: t.label }}>
          Escolha o melhor horário, {getFirstName(session.person.name)}:
        </p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: accent + "15", color: accent }}>
          {duration} min
        </span>
      </div>

      {/* Calendar card */}
      <div
        className="rounded-[2px] overflow-hidden"
        style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.sepBorder}` }}>
          <button
            onClick={() => setCalWeekStart(addDays(calWeekStart, -7))}
            className="w-8 h-8 flex items-center justify-center rounded-[2px] transition-colors"
            style={{ color: t.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = t.body; e.currentTarget.style.background = t.pillBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.muted; e.currentTarget.style.background = "transparent"; }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold capitalize" style={{ color: t.body }}>
              {format(calWeekStart, "MMMM yyyy", { locale: ptBR })}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: t.muted }}>
              {format(calWeekStart, "d MMM", { locale: ptBR })} – {format(addDays(calWeekStart, 6), "d MMM", { locale: ptBR })}
            </p>
          </div>
          <button
            onClick={() => setCalWeekStart(addDays(calWeekStart, 7))}
            className="w-8 h-8 flex items-center justify-center rounded-[2px] transition-colors"
            style={{ color: t.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = t.body; e.currentTarget.style.background = t.pillBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.muted; e.currentTarget.style.background = "transparent"; }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day grid (gap-1 p-3 — matches AgendamentoPublico) */}
        <div className="grid grid-cols-7 gap-0.5 p-2 sm:gap-1 sm:p-3">
          {calDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const hasSlots = !!slotsByDate[dateKey];
            const isSelected = !!selectedDate && isSameDay(day, selectedDate);
            const isTdy = isToday(day);
            return (
              <button
                key={dateKey}
                disabled={!hasSlots}
                onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                className="relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-[2px] transition-all duration-150"
                style={{
                  background: isSelected ? accent : undefined,
                  boxShadow: isSelected ? "0 1px 3px rgba(0,0,0,0.12)" : undefined,
                  color: isSelected ? "#fff" : hasSlots ? t.body : t.disabledText,
                  cursor: hasSlots ? "pointer" : "not-allowed",
                  transform: isSelected ? "scale(1.05)" : undefined,
                }}
              >
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider leading-none"
                  style={{ color: isSelected ? "rgba(255,255,255,0.7)" : t.muted }}
                >
                  {format(day, "EEE", { locale: ptBR })}
                </span>
                <span
                  className="text-sm font-bold leading-none"
                  style={{ color: isSelected ? "#fff" : isTdy && hasSlots ? accent : undefined }}
                >
                  {format(day, "d")}
                </span>
                {hasSlots && !isSelected && (
                  <span
                    className="absolute bottom-1.5 w-1 h-1 rounded-full"
                    style={{ background: isTdy ? accent : accent + "50" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots card */}
      {selectedDate && (
        <div
          className="rounded-[2px] overflow-hidden"
          style={{ background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${t.sepBorder}` }}>
            <p className="text-sm font-semibold capitalize" style={{ color: t.body }}>
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: t.pillBg, color: t.pillText }}>
              {slotsForDate.length} {slotsForDate.length === 1 ? "horário" : "horários"}
            </span>
          </div>

          <div className="p-4">
            {slotsForDate.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <Clock className="w-6 h-6" style={{ color: t.disabledText, opacity: 0.4 }} />
                <p className="text-sm" style={{ color: t.muted }}>Sem horários disponíveis neste dia</p>
              </div>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))" }}>
                {slotsForDate.map((slot) => {
                  const isSel = selectedSlot?.start_time === slot.start_time && selectedSlot?.date === slot.date;
                  return (
                    <button
                      key={`${slot.date}-${slot.start_time}`}
                      onClick={() => setSelectedSlot(slot)}
                      className="py-2.5 rounded-[2px] text-sm font-semibold transition-all duration-150"
                      style={{
                        background: isSel ? accent : t.input,
                        color: isSel ? "#fff" : t.body,
                        border: isSel ? `1px solid ${accent}` : `1px solid ${t.slotBorder}`,
                        boxShadow: isSel ? "0 1px 3px rgba(0,0,0,0.12)" : undefined,
                        transform: isSel ? "scale(1.05)" : undefined,
                      }}
                      onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.borderColor = t.slotHoverBorder; e.currentTarget.style.background = t.slotHoverBg; } }}
                      onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.borderColor = t.slotBorder; e.currentTarget.style.background = t.input; } }}
                    >
                      {slot.start_time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedDate && (
        <div className="flex flex-col items-center gap-2 py-4" style={{ color: t.disabledText }}>
          <Calendar className="w-6 h-6" />
          <p className="text-sm" style={{ color: t.muted }}>Selecione um dia no calendário</p>
        </div>
      )}

      {/* Selected summary + Confirm (matches AgendamentoPublico: always-visible button) */}
      <div className="space-y-3 pt-1">
        {selectedSlot && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[2px]" style={{ background: accent + "0D", border: `1px solid ${accent}30` }}>
            <CalendarCheck className="w-4 h-4 shrink-0" style={{ color: accent }} />
            <p className="text-sm font-medium" style={{ color: accent }}>
              {selectedDate && format(selectedDate, "d MMM", { locale: ptBR })} às {selectedSlot.start_time} · {duration} min
            </p>
          </div>
        )}

        {/* Email opcional — só quando o lead não tem email salvo. Em branco = pular;
            o botão Confirmar não fica bloqueado. */}
        {needsEmail && (
          <div className="space-y-1.5">
            <label htmlFor="inline-lead-email" className="block text-xs font-medium" style={{ color: t.label }}>
              Seu email <span style={{ color: t.muted }}>(opcional — para receber o convite da reunião)</span>
            </label>
            <input
              id="inline-lead-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
              placeholder="voce@exemplo.com"
              className="w-full h-11 px-3 rounded-[2px] text-sm outline-none transition-colors"
              style={{
                background: t.input,
                color: t.body,
                border: `2px solid ${emailError ? (isDark ? "rgba(239,68,68,0.5)" : "#fca5a5") : t.slotBorder}`,
              }}
              onFocus={(e) => { if (!emailError) e.currentTarget.style.borderColor = t.slotHoverBorder; }}
              onBlur={(e) => { if (!emailError) e.currentTarget.style.borderColor = t.slotBorder; }}
            />
            {emailError && (
              <p className="text-xs" style={{ color: isDark ? "#fca5a5" : "#dc2626" }}>{emailError}</p>
            )}
          </div>
        )}

        <button
          disabled={!selectedSlot || confirming}
          onClick={confirm}
          className="w-full h-12 rounded-[4px] text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            background: selectedSlot && !confirming ? accent : t.disabledBg,
            color: selectedSlot && !confirming ? "#fff" : t.muted,
            cursor: selectedSlot && !confirming ? "pointer" : "not-allowed",
            boxShadow: selectedSlot && !confirming ? "0 2px 6px rgba(0,0,0,0.15)" : undefined,
          }}
          onMouseEnter={(e) => { if (selectedSlot && !confirming) e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          {confirming ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando…</>
          ) : (
            <><CalendarCheck className="w-4 h-4" /> Confirmar reunião</>
          )}
        </button>
      </div>
    </div>
  );
}
