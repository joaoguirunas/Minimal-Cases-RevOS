
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { format, addDays, isSameDay, isToday, startOfToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Calendar, AlertCircle, Loader2, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────

interface Slot {
  date:       string;
  start_time: string;
  end_time:   string;
}

interface ExistingMeeting {
  meeting_id: string;
  start_time: string; // wall-clock SP (ISO sem TZ ou "yyyy-MM-dd HH:mm:ss")
  end_time:   string;
  consultor:  { id: string; name: string } | null;
}

interface SessionData {
  // has_email: o lead já tem email salvo? Ausente/undefined → tratado como false
  // (mostra o input opcional) por degradação segura, caso a sessão venha de uma
  // versão antiga da RPC que não popula o campo.
  person:           { id: string; name: string; email: string | null; has_email?: boolean };
  slots:            Slot[];
  existing_meeting?: ExistingMeeting | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFirstName(name: string) {
  return name.split(' ')[0];
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
// ainda não está no types.ts gerado. Evita o `any` do client cast usado nas
// outras RPCs; basta regenerar os types após o apply para remover este wrapper.
type LeadEmailRpc = (
  fn: 'set_booking_lead_email',
  args: { p_lead_id: string; p_email: string },
) => Promise<{ data: SetEmailResult | null }>;

// Persiste o email do lead via RPC SECURITY DEFINER, escopada ao lead do link.
async function setBookingLeadEmail(leadId: string, email: string): Promise<SetEmailResult> {
  const rpc = supabase.rpc as unknown as LeadEmailRpc;
  const { data } = await rpc('set_booking_lead_email', { p_lead_id: leadId, p_email: email });
  return data ?? {};
}

function groupSlotsByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
}

// existing_meeting.start_time vem como wall-clock SP (ISO ou "yyyy-MM-dd HH:mm:ss").
// Interpreta os componentes literais como horário local p/ exibição, sem shift de TZ.
function parseWallClock(value: string): Date {
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return new Date(value);
  const [, y, mo, d, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

async function resolveRuleSetId(r: string): Promise<string | undefined> {
  if (/^\d+$/.test(r)) {
    const { data } = await supabase
      .from('booking_rule_sets' as any)
      .select('id')
      .eq('url_id', parseInt(r))
      .eq('is_active', true)
      .single();
    return (data as any)?.id ?? undefined;
  }
  return r;
}

// ── Sub-components ───────────────────────────────────────────────────────────

const StepIndicator = ({ step }: { step: 1 | 2 }) => (
  <div className="flex items-center gap-2">
    <div className={cn(
      'flex items-center gap-1.5 text-xs font-semibold transition-all',
      step === 1 ? 'text-primary' : 'text-muted-foreground/50'
    )}>
      <span className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all',
        step > 1
          ? 'bg-emerald-500 border-emerald-500 text-white'
          : step === 1
          ? 'border-primary text-primary bg-primary/10'
          : 'border-border text-muted-foreground'
      )}>
        {step > 1 ? '✓' : '1'}
      </span>
      <span className={step === 1 ? 'text-primary' : 'text-muted-foreground/40'}>Horário</span>
    </div>

    <div className={cn('h-px w-8 transition-colors', step > 1 ? 'bg-emerald-400' : 'bg-border/60')} />

    <div className={cn(
      'flex items-center gap-1.5 text-xs font-semibold transition-all',
      step === 2 ? 'text-primary' : 'text-muted-foreground/40'
    )}>
      <span className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all',
        step === 2
          ? 'border-primary text-primary bg-primary/10'
          : 'border-border text-muted-foreground/40'
      )}>
        2
      </span>
      <span>Confirmado</span>
    </div>
  </div>
);

const ConsultorAvatar = ({ name }: { name: string }) => {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-primary/20">
      {initials}
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────

const AgendamentoPublico = () => {
  const { leadId }     = useParams<{ leadId: string }>();
  const [searchParams] = useSearchParams();

  const duration = parseInt(searchParams.get('d') || '30') || 30;
  const rParam   = searchParams.get('r') || undefined;

  const [step,               setStep]               = useState<1 | 2>(1);
  const [session,            setSession]            = useState<SessionData | null>(null);
  const [resolvedRuleSetId,  setResolvedRuleSetId]  = useState<string | undefined>(undefined);
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState<string | null>(null);
  const [logoUrl,            setLogoUrl]            = useState<string | null>(null);
  const [companyName,        setCompanyName]        = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [calWeekStart, setCalWeekStart] = useState<Date>(startOfToday());

  // Email opcional: só pedido quando o lead não tem email salvo. Vazio = pular.
  const [email,      setEmail]      = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  // Aviso NÃO-bloqueante (AC9c): RPC rejeitou o email após passar na regex local
  // (divergência residual) → o booking segue, mas o lead fica ciente de que o
  // convite não virá.
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const [confirming,         setConfirming]         = useState(false);
  const [meetingId,          setMeetingId]          = useState<string | null>(null);
  const [confirmedConsultor, setConfirmedConsultor] = useState<{ id: string; name: string } | null>(null);

  // Se a reunião existente já terminou, libera o reagendamento.
  const effectiveExistingMeeting = (() => {
    const em = session?.existing_meeting;
    if (!em) return null;
    return parseWallClock(em.end_time) > new Date() ? em : null;
  })();

  useEffect(() => {
    supabase
      .from('settings' as any)
      .select('logo_url, company_name')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLogoUrl((data as any).logo_url ?? null);
          setCompanyName((data as any).company_name ?? null);
        }
      });
  }, []);

  useEffect(() => {
    if (!leadId) return;
    // Validate UUID format before calling RPC (avoids cryptic Postgres errors)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(leadId)) {
      setError('Link de agendamento inválido. Por favor, solicite um novo link.');
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resolved = rParam ? await resolveRuleSetId(rParam) : undefined;
        setResolvedRuleSetId(resolved);
        // Disponibilidade via edge function — considera o Google Calendar externo
        // dos consultores. Fallback para a RPC direta (só agenda interna) se a
        // função estiver indisponível, para nunca derrubar a página.
        let data: any;
        let sErr: any;
        try {
          const res = await supabase.functions.invoke('booking-availability', {
            body: { lead_id: leadId, rule_set_id: resolved ?? null, duration, days_ahead: 14 },
          });
          if (res.error) throw res.error;
          data = res.data;
        } catch (fnErr) {
          console.warn('[booking-availability] fallback para RPC direta:', fnErr);
          const res = await (supabase as any).rpc('get_booking_session', {
            p_lead_id:     leadId,
            p_rule_set_id: resolved ?? null,
            p_duration:    duration,
            p_days_ahead:  14,
          });
          sErr = res.error;
          data = res.data;
        }
        if (sErr) throw new Error(sErr.message);
        if (data?.error) throw new Error(data.error);
        setSession(data as SessionData);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar informações');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [leadId]);

  // Pré-seleciona o 1º dia com slots quando a session carrega (sem reunião já marcada).
  useEffect(() => {
    if (!session || effectiveExistingMeeting) return;
    const firstDate = session.slots[0]?.date;
    if (!firstDate) return;
    const day = parseWallClock(firstDate + 'T12:00');
    setSelectedDate(day);
    setCalWeekStart(startOfDay(day));
  }, [session]);

  // Lead sem email salvo → input opcional. has_email ausente é tratado como
  // false (degradação segura — campo opcional não trava ninguém).
  const needsEmail   = !session?.person.has_email;
  const trimmedEmail = email.trim();

  const confirm = async () => {
    if (!session || !selectedSlot) return;
    setConfirming(true);
    setError(null);
    setEmailError(null);
    setEmailWarning(null);
    try {
      // Coleta opcional de email (AGENDA-GCAL-03): só quando o lead não tem email
      // e digitou algo. Vazio = pular (segue sem convidar o lead no GCal).
      // Persiste ANTES do booking — o gcal_sync lê clients_people.email server-side.
      if (needsEmail && trimmedEmail) {
        // AC3: formato inválido pela regex local bloqueia até corrigir ou limpar.
        if (!isValidEmail(trimmedEmail)) {
          setEmailError('Informe um email válido ou deixe o campo em branco.');
          setConfirming(false);
          return;
        }
        const emailRes = await setBookingLeadEmail(leadId!, trimmedEmail);
        // AC9c: passou na regex local mas a RPC rejeitou (divergência residual).
        // NÃO bloqueia — o booking segue; só avisa que o convite não virá.
        // ok / skipped:already_has_email → sucesso silencioso.
        if (emailRes.error === 'invalid_email') {
          setEmailWarning('O email parece inválido — você não receberá o convite no calendário.');
        }
      }

      // Slots são wall-clock de São Paulo (UTC-3, sem DST desde 2019). Ancore o
      // offset explicitamente p/ não depender do fuso do navegador do lead — assim
      // o instante gravado bate com o horário exibido e com o filtro da RPC (SP).
      const toISO = (d: string, t: string) => new Date(`${d}T${t}:00-03:00`).toISOString();

      const startISO = toISO(selectedSlot.date, selectedSlot.start_time);
      const endISO   = toISO(selectedSlot.date, selectedSlot.end_time);

      // Agendamento via edge function — não atribui a reunião a um consultor que
      // esteja ocupado no Google Calendar externo no horário. Fallback para a RPC
      // direta (atribuição só por agenda interna) se a função estiver indisponível.
      let data: any;
      let bErr: any;
      try {
        const res = await supabase.functions.invoke('booking-availability', {
          body: {
            action:      'confirm',
            lead_id:     leadId,
            start_time:  startISO,
            end_time:    endISO,
            rule_set_id: resolvedRuleSetId ?? null,
            duration,
            notes:       null,
          },
        });
        if (res.error) throw res.error;
        data = res.data;
      } catch (fnErr) {
        console.warn('[booking-availability:confirm] fallback para RPC direta:', fnErr);
        const res = await (supabase as any).rpc('book_meeting', {
          p_lead_id:     leadId,
          p_start_time:  startISO,
          p_end_time:    endISO,
          p_rule_set_id: resolvedRuleSetId ?? null,
          p_duration:    duration,
          p_notes:       null,
        });
        bErr = res.error;
        data = res.data;
      }

      if (bErr) throw new Error(bErr.message);
      if (data?.error) throw new Error(data.error);

      setMeetingId(data.meeting_id);
      setConfirmedConsultor(data.consultor ?? null);
      setStep(2);

      // Issue short-lived single-use action tokens (SCH-H-1), then fire side-effects.
      supabase.functions.invoke('public-booking', {
        body: { action: 'issue_tokens', meeting_id: data.meeting_id },
      }).then(async ({ data: tokensData, error: tokensErr }) => {
        if (tokensErr || !tokensData) {
          console.warn('[issue_tokens] failed:', tokensErr);
          return;
        }
        const { gcal_sync_token, wa_confirm_token } = tokensData as { gcal_sync_token: string; wa_confirm_token: string };

        await Promise.allSettled([
          supabase.functions.invoke('public-booking', {
            body: { action: 'gcal_sync', meeting_id: data.meeting_id, capability_token: gcal_sync_token },
          }).then(({ data: gcalData, error: gcalErr }) => {
            if (gcalErr) console.warn('[gcal_sync] error:', gcalErr);
            else console.log('[gcal_sync] result:', gcalData);
          }),
          supabase.functions.invoke('public-booking', {
            body: { action: 'wa_confirm', meeting_id: data.meeting_id, capability_token: wa_confirm_token },
          }).then(({ data: waData, error: waErr }) => {
            if (waErr) console.warn('[wa_confirm] error:', waErr);
            else console.log('[wa_confirm] result:', waData);
          }),
        ]);
      }).catch((err) => {
        console.warn('[issue_tokens] unexpected error:', err);
      });
    } catch (e: any) {
      setError(e.message || 'Erro ao confirmar');
    } finally {
      setConfirming(false);
    }
  };

  const slotsByDate  = session ? groupSlotsByDate(session.slots) : {};
  const calDays      = Array.from({ length: 7 }, (_, i) => addDays(calWeekStart, i));
  const slotsForDate = selectedDate ? (slotsByDate[format(selectedDate, 'yyyy-MM-dd')] || []) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/[0.06] via-background to-muted flex flex-col">

      {/* ── Header: logo centered ────────────────────────────────────────── */}
      <header className="pt-8 pb-6 flex flex-col items-center gap-2">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName ?? 'Logo'} className="h-10 max-w-[200px] object-contain" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <CalendarCheck className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="text-base font-bold text-foreground tracking-tight">
              {companyName ?? 'Schedule PRO™'}
            </span>
          </div>
        )}
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex justify-center px-4 pb-16">
        <div className="w-full max-w-[400px] space-y-5">

          {/* ── Error ──────────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Loading ────────────────────────────────────────────────── */}
          {loading && (
            <div className="space-y-4 pt-2">
              <div className="h-24 rounded-md bg-muted animate-pulse" />
              <div className="h-44 rounded-md bg-muted animate-pulse" />
              <div className="h-28 rounded-md bg-muted animate-pulse" />
            </div>
          )}

          {/* ── Reunião já marcada (bloqueia re-agendamento) ─────────────── */}
          {!loading && effectiveExistingMeeting && (() => {
            const em        = effectiveExistingMeeting;
            const emStart   = parseWallClock(em.start_time);
            const emEnd     = parseWallClock(em.end_time);
            const consultor = em.consultor;
            return (
              <div className="space-y-5">
                {/* Hero */}
                <div className="bg-card rounded-md border border-border px-6 py-8 text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center ring-4 ring-emerald-500/10">
                      <CalendarCheck className="w-9 h-9 text-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Você já tem uma reunião marcada</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getFirstName(session.person.name)}, confira os detalhes abaixo.
                    </p>
                  </div>
                </div>

                {/* Meeting details */}
                <div className="bg-card rounded-md border border-border overflow-hidden">
                  {consultor && (
                    <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
                      <ConsultorAvatar name={consultor.name} />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Seu consultor</p>
                        <p className="text-sm font-bold text-foreground">{consultor.name}</p>
                      </div>
                    </div>
                  )}

                  <div className="px-5 py-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Data</p>
                        <p className="text-sm font-semibold text-foreground capitalize mt-0.5">
                          {format(emStart, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Horário</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {format(emStart, 'HH:mm')} — {format(emEnd, 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Protocol */}
                <p className="text-center text-[11px] text-muted-foreground/50">
                  Protocolo:{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                    {em.meeting_id.slice(0, 8).toUpperCase()}
                  </code>
                </p>
              </div>
            );
          })()}

          {/* ── Step 1 ─────────────────────────────────────────────────── */}
          {!loading && session && !effectiveExistingMeeting && step === 1 && (
            <>
              {/* Greeting + step indicator */}
              <div className="bg-card rounded-md border border-border px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Olá,</p>
                    <h1 className="text-[1.6rem] font-bold text-foreground leading-tight truncate">
                      {getFirstName(session.person.name)} 👋
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Escolha o melhor horário para sua reunião.
                    </p>
                  </div>
                  {/* Duration badge */}
                  <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
                    <div className="w-11 h-11 rounded-md bg-primary/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[10px] font-semibold text-primary whitespace-nowrap">{duration} min</span>
                  </div>
                </div>

                {/* Step indicator below greeting */}
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Schedule PRO™</span>
                  <StepIndicator step={step} />
                </div>
              </div>

              {/* Calendar */}
              <div className="bg-card rounded-md border border-border overflow-hidden">
                {/* Month nav */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <button
                    onClick={() => setCalWeekStart(addDays(calWeekStart, -7))}
                    className="w-[30px] h-[30px] flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground capitalize">
                      {format(calWeekStart, 'MMMM yyyy', { locale: ptBR })}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(calWeekStart, "d MMM", { locale: ptBR })} – {format(addDays(calWeekStart, 6), "d MMM", { locale: ptBR })}
                    </p>
                  </div>
                  <button
                    onClick={() => setCalWeekStart(addDays(calWeekStart, 7))}
                    className="w-[30px] h-[30px] flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-0.5 p-2 sm:gap-1 sm:p-3">
                  {calDays.map(day => {
                    const dateKey    = format(day, 'yyyy-MM-dd');
                    const hasSlots   = !!slotsByDate[dateKey];
                    const isSelected = !!selectedDate && isSameDay(day, selectedDate);
                    const isTdy      = isToday(day);
                    return (
                      <button
                        key={dateKey}
                        disabled={!hasSlots}
                        onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                        className={cn(
                          'relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-md transition-all duration-150',
                          isSelected
                            ? 'bg-primary text-primary-foreground scale-105'
                            : hasSlots
                            ? 'hover:bg-primary/8 text-foreground cursor-pointer'
                            : 'text-muted-foreground/25 cursor-not-allowed'
                        )}
                      >
                        <span className={cn(
                          'text-[9px] font-semibold uppercase tracking-wider leading-none',
                          isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {format(day, 'EEE', { locale: ptBR })}
                        </span>
                        <span className={cn(
                          'text-sm font-bold leading-none',
                          isTdy && !isSelected && hasSlots && 'text-primary'
                        )}>
                          {format(day, 'd')}
                        </span>
                        {/* availability dot */}
                        {hasSlots && !isSelected && (
                          <span className={cn(
                            'absolute bottom-1.5 w-1 h-1 rounded-full',
                            isTdy ? 'bg-primary' : 'bg-primary/50'
                          )} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div className="bg-card rounded-md border border-border overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground capitalize">
                      {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {slotsForDate.length} {slotsForDate.length === 1 ? 'horário' : 'horários'}
                    </span>
                  </div>

                  <div className="p-4">
                    {slotsForDate.length === 0 ? (
                      <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                        <Clock className="w-6 h-6 opacity-30" />
                        <p className="text-sm">Sem horários disponíveis neste dia</p>
                      </div>
                    ) : (
                      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))" }}>
                        {slotsForDate.map(slot => {
                          const isSel = selectedSlot?.start_time === slot.start_time &&
                                        selectedSlot?.date === slot.date;
                          return (
                            <button
                              key={`${slot.date}-${slot.start_time}`}
                              onClick={() => setSelectedSlot(slot)}
                              className={cn(
                                'py-2.5 rounded-md text-sm font-semibold border-2 transition-all duration-150',
                                isSel
                                  ? 'bg-primary text-primary-foreground border-primary scale-105'
                                  : 'bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5'
                              )}
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
                <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground/60">
                  <Calendar className="w-6 h-6" />
                  <p className="text-sm">Selecione um dia no calendário</p>
                </div>
              )}

              {/* Selected summary + Confirm button */}
              <div className="space-y-3 pt-1">
                {selectedSlot && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-primary/8 border border-primary/20">
                    <CalendarCheck className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm font-medium text-primary">
                      {selectedDate && format(selectedDate, "d MMM", { locale: ptBR })} às {selectedSlot.start_time} · {duration} min
                    </p>
                  </div>
                )}

                {/* Email opcional — só quando o lead não tem email salvo. Deixar em
                    branco pula a coleta; o botão Confirmar não fica bloqueado. */}
                {needsEmail && (
                  <div className="space-y-1.5">
                    <label htmlFor="lead-email" className="block text-xs font-medium text-muted-foreground">
                      Seu email <span className="text-muted-foreground/60">(opcional — para receber o convite da reunião)</span>
                    </label>
                    <input
                      id="lead-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                      placeholder="voce@exemplo.com"
                      className={cn(
                        'w-full h-11 px-3 rounded-md text-sm bg-background border-2 transition-colors outline-none',
                        emailError
                          ? 'border-rose-300 focus:border-rose-400'
                          : 'border-border focus:border-primary/40'
                      )}
                    />
                    {emailError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">{emailError}</p>
                    )}
                  </div>
                )}

                <button
                  disabled={!selectedSlot || confirming}
                  onClick={confirm}
                  className={cn(
                    'w-full h-12 rounded-md text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2',
                    selectedSlot && !confirming
                      ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {confirming
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando…</>
                    : <><CalendarCheck className="w-4 h-4" /> Confirmar reunião</>}
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Confirmed ────────────────────────────────────────── */}
          {step === 2 && session && selectedSlot && (
            <div className="space-y-5">
              {/* Success hero */}
              <div className="bg-card rounded-md border border-border px-6 py-8 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center ring-4 ring-emerald-500/10">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Reunião confirmada!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getFirstName(session.person.name)}, você receberá uma confirmação em breve.
                  </p>
                </div>
                <div className="pt-1">
                  <StepIndicator step={2} />
                </div>
              </div>

              {/* Aviso não-bloqueante (AC9c): email rejeitado pela RPC — reunião
                  confirmada, mas o convite no calendário não será enviado. */}
              {emailWarning && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{emailWarning}</span>
                </div>
              )}

              {/* Meeting details */}
              <div className="bg-card rounded-md border border-border overflow-hidden">
                {confirmedConsultor && (
                  <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
                    <ConsultorAvatar name={confirmedConsultor.name} />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Seu consultor</p>
                      <p className="text-sm font-bold text-foreground">{confirmedConsultor.name}</p>
                    </div>
                  </div>
                )}

                <div className="px-5 py-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Data</p>
                      <p className="text-sm font-semibold text-foreground capitalize mt-0.5">
                        {format(new Date(selectedSlot.date + 'T12:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Horário</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {selectedSlot.start_time} — {selectedSlot.end_time}
                        <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{duration} min</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protocol */}
              {meetingId && (
                <p className="text-center text-[11px] text-muted-foreground/50">
                  Protocolo:{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                    {meetingId.slice(0, 8).toUpperCase()}
                  </code>
                </p>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="text-center py-6">
        <p className="text-[10px] text-muted-foreground/40">
          Developed by{' '}
          <a
            href="https://www.growthsales.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground/70 transition-colors underline underline-offset-2"
          >
            growthsales.ai
          </a>
        </p>
      </footer>
    </div>
  );
};

export default AgendamentoPublico;
