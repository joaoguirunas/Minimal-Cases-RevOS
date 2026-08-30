import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  ArrowLeft, CalendarIcon, Check, Clock, User,
  Shuffle, UserCheck, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNegocios } from '@/hooks/useNegocios';
import { useConsultorDisponibilidade } from '@/hooks/useConsultorDisponibilidade';
import { useCriarAgendamento } from '@/hooks/useAgendamentos';
import { useAuth } from '@/hooks/useAuth';

type MeetingType = 'discovery' | 'demo' | 'closing' | 'consulting' | 'mentoring' | 'qbr' | 'followup' | 'other';

// ─── Types ────────────────────────────────────────────────────────────────────

type AssignmentMode = 'auto' | 'manual';
type Step = 1 | 2 | 3;

interface SelectedLead {
  id: string;
  clientName: string;
  value?: number;
}

interface SelectedConsultor {
  id: string;
  nome: string;
  email?: string;
}

interface WizardState {
  step: Step;
  selectedLead: SelectedLead | null;
  assignmentMode: AssignmentMode | null;
  selectedConsultor: SelectedConsultor | null; // only used in manual mode
  selectedDate: Date | undefined;
  selectedDuration: number;
  selectedTimeSlot: { start: string; end: string } | null;
  notes: string;
  location: string;
  meetingType: MeetingType | '';
}

const INITIAL_STATE: WizardState = {
  step: 1,
  selectedLead: null,
  assignmentMode: null,
  selectedConsultor: null,
  selectedDate: undefined,
  selectedDuration: 60,
  selectedTimeSlot: null,
  notes: '',
  location: '',
  meetingType: 'discovery',
};

const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: 'discovery',  label: 'Discovery Call' },
  { value: 'demo',       label: 'Demo / Pitch' },
  { value: 'closing',    label: 'Reunião de Fecho' },
  { value: 'consulting', label: 'Consultoria' },
  { value: 'mentoring',  label: 'Mentoria' },
  { value: 'qbr',        label: 'QBR' },
  { value: 'followup',   label: 'Follow-up' },
  { value: 'other',      label: 'Outro' },
];

const DURATION_OPTIONS = [
  { value: 30, label: '30min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
];

const STEP_LABELS: Record<Step, string> = {
  1: 'Negócio',
  2: 'Distribuição',
  3: 'Agenda',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  initialLead?: { id: string; clientName: string; value?: number };
}

const NovaReuniaoWizardModal = ({ open, onOpenChange, initialLead }: Props) => {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isUserType = user?.profile?.user_type === 'user';

  useEffect(() => {
    if (open) {
      const selfConsultor = isUserType && user?.profile
        ? { id: user.profile.id, nome: user.profile.nome, email: user.profile.email || undefined }
        : null;
      setState({
        ...INITIAL_STATE,
        selectedLead: initialLead ?? null,
        step: initialLead ? (isUserType ? 3 : 2) : 1,
        assignmentMode: isUserType ? 'manual' : null,
        selectedConsultor: selfConsultor,
      });
      setSearchTerm('');
      setShowDetails(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data hooks ──────────────────────────────────────────────────────────────

  const { data: negocios = [], isLoading: isLoadingNegocios } = useNegocios();
  const criarAgendamento = useCriarAgendamento();

  // Consultores list — for manual mode
  const { data: consultores = [] } = useQuery({
    queryKey: ['consultores-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_users')
        .select('id, name, email')
        .eq('active', true)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; email: string | null }>;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Booking session slots — for auto mode (distribution rules)
  const { data: bookingSession, isLoading: isLoadingAutoSlots } = useQuery({
    queryKey: ['booking-session-slots', state.selectedLead?.id, state.selectedDuration],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_booking_session', {
        p_lead_id:     state.selectedLead!.id,
        p_rule_set_id: null,
        p_duration:    state.selectedDuration,
        p_days_ahead:  14,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { person: { id: string; name: string; email: string | null }; slots: Array<{ date: string; start_time: string; end_time: string }> };
    },
    enabled: !!state.selectedLead?.id && state.assignmentMode === 'auto' && state.step === 3,
    staleTime: 2 * 60 * 1000,
  });

  // Time slots for manual mode — specific consultant + date
  const { data: consultorSlots = [] } = useConsultorDisponibilidade({
    consultorId: state.assignmentMode === 'manual' ? (state.selectedConsultor?.id || '') : '',
    date: state.selectedDate ? format(state.selectedDate, 'yyyy-MM-dd') : '',
    duration: state.selectedDuration,
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const negociosAtivos = useMemo(
    () =>
      negocios.filter((n) => {
        const clientName = n.person?.name || n.pessoa?.nome || n.pessoa?.name || '';
        return (
          n.status === 'in_progress' &&
          (searchTerm === '' || clientName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }),
    [negocios, searchTerm],
  );

  // Group auto slots by date for quick lookup
  const autoSlotsByDate = useMemo(() => {
    const slots = bookingSession?.slots || [];
    return slots.reduce(
      (acc, slot) => {
        if (!acc[slot.date]) acc[slot.date] = [];
        acc[slot.date].push({ start: slot.start_time, end: slot.end_time });
        return acc;
      },
      {} as Record<string, Array<{ start: string; end: string }>>,
    );
  }, [bookingSession]);

  // Slots for the selected date
  const slotsForSelectedDate = useMemo(() => {
    if (!state.selectedDate) return [];
    if (state.assignmentMode === 'auto') {
      return autoSlotsByDate[format(state.selectedDate, 'yyyy-MM-dd')] || [];
    }
    // manual mode — already filtered by useConsultorDisponibilidade
    return consultorSlots
      .filter((s) => s.available)
      .map((s) => ({ start: s.start.slice(0, 5), end: s.end.slice(0, 5) }));
  }, [state.selectedDate, state.assignmentMode, autoSlotsByDate, consultorSlots]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const canAdvance = (): boolean => {
    if (state.step === 1) return !!state.selectedLead;
    if (state.step === 2) {
      if (state.assignmentMode === 'auto') return true;
      if (state.assignmentMode === 'manual') return !!state.selectedConsultor;
      return false;
    }
    if (state.step === 3) return !!state.selectedTimeSlot?.start && !!state.selectedTimeSlot?.end;
    return false;
  };

  const handleNext = () => {
    if (!canAdvance()) {
      const msgs: Record<number, string> = {
        1: 'Selecione um negócio para continuar',
        2: 'Escolha o modo de distribuição para continuar',
        3: 'Selecione um horário para confirmar',
      };
      toast.error(msgs[state.step]);
      return;
    }
    if (isUserType && state.step === 1) {
      setState((prev) => ({ ...prev, step: 3 }));
    } else {
      setState((prev) => ({ ...prev, step: (prev.step + 1) as Step }));
    }
  };

  const handleBack = () => {
    if (isUserType && state.step === 3) {
      setState((prev) => ({ ...prev, step: 1 }));
    } else {
      setState((prev) => ({ ...prev, step: (prev.step - 1) as Step }));
    }
  };

  const handleClose = () => onOpenChange(false);

  const handleConfirm = async () => {
    if (!state.selectedLead || !state.assignmentMode || !state.selectedDate || !state.selectedTimeSlot) {
      toast.error('Dados incompletos');
      return;
    }

    const dateStr = format(state.selectedDate, 'yyyy-MM-dd');
    const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

    try {
      if (state.assignmentMode === 'auto') {
        // Auto: use book_meeting RPC — picks consultant via distribution rules
        const startISO = new Date(`${dateStr}T${normalizeTime(state.selectedTimeSlot.start)}`).toISOString();
        const endISO   = new Date(`${dateStr}T${normalizeTime(state.selectedTimeSlot.end)}`).toISOString();

        const { data, error: rpcErr } = await (supabase as any).rpc('book_meeting', {
          p_lead_id:     state.selectedLead.id,
          p_start_time:  startISO,
          p_end_time:    endISO,
          p_rule_set_id: null,
          p_duration:    state.selectedDuration,
          p_notes:       state.notes || null,
        });

        if (rpcErr) throw new Error(rpcErr.message);
        if (data?.error) throw new Error(data.error);

        const meetingId: string = data.meeting_id;

        // Persist meeting_type
        if (state.meetingType) {
          supabase.from('meetings').update({ meeting_type: state.meetingType }).eq('id', meetingId).catch(() => {});
        }

        queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
        toast.success('Reunião agendada com sucesso!');

        // Fire-and-forget GCal sync via google-cal-upsert-event (same path as manual mode)
        supabase.functions
          .invoke('google-cal-upsert-event', { body: { meeting_id: meetingId, action: 'create' } })
          .then(({ data: gcalData, error: gcalErr }) => {
            if (gcalErr) console.warn('[gcal] upsert error:', gcalErr);
            else {
              const d = gcalData as { skipped?: boolean; reason?: string; success?: boolean } | null;
              if (d?.success) queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
              else if (d?.skipped) console.info('[gcal] skipped:', d.reason);
            }
          })
          .catch((err) => console.warn('[gcal] upsert exception:', err));

        handleClose();
      } else {
        // Manual: insert directly with explicit consultant
        if (!state.selectedConsultor) { toast.error('Selecione um consultor'); return; }

        const meetingPayload = {
          lead_id:    state.selectedLead.id,
          user_id:    state.selectedConsultor.id,
          title:      `Reunião — ${state.selectedLead.clientName}`,
          date:       dateStr,
          start_time: normalizeTime(state.selectedTimeSlot.start),
          end_time:   normalizeTime(state.selectedTimeSlot.end),
          location:   state.location || undefined,
          notes:      state.notes || undefined,
          status:     'agendado',
        };
        // meeting_type is not in the typed interface but the hook inserts into meetings table which supports it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (meetingPayload as any).meeting_type = state.meetingType || undefined;
        await criarAgendamento.mutateAsync(meetingPayload);

        handleClose();
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao confirmar reunião');
    }
  };

  // ── Step indicator ────────────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const visibleSteps = isUserType ? ([1, 3] as Step[]) : ([1, 2, 3] as Step[]);
    const stepNumbers: Record<number, number> = isUserType ? { 1: 1, 3: 2 } : { 1: 1, 2: 2, 3: 3 };

    return (
      <div className="flex items-center gap-1 mb-5">
        {visibleSteps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <div className="w-6 h-px bg-border" />}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors',
                  state.step === s
                    ? 'bg-primary text-primary-foreground'
                    : state.step > s
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {state.step > s ? <Check className="w-3 h-3" /> : stepNumbers[s]}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  state.step === s ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Step 1 — Negócio ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-3">
      <Input
        placeholder="Buscar por nome do cliente..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus
      />
      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
        {isLoadingNegocios ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Carregando negócios...</p>
        ) : negociosAtivos.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">
            {negocios.length === 0 ? 'Nenhum negócio cadastrado' : 'Nenhum resultado encontrado'}
          </p>
        ) : (
          negociosAtivos.map((negocio) => {
            const clientName =
              negocio.person?.name || negocio.pessoa?.nome || negocio.pessoa?.name || 'Cliente';
            const email = negocio.person?.email || negocio.pessoa?.email || '';
            const value = negocio.value || negocio.valor;
            const isSelected = state.selectedLead?.id === negocio.id;
            return (
              <button
                key={negocio.id}
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    selectedLead: { id: negocio.id, clientName, value },
                  }))
                }
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-[4px] border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{clientName}</p>
                    {email && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {value ? (
                      <span className="text-xs text-muted-foreground">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          maximumFractionDigits: 0,
                        }).format(value)}
                      </span>
                    ) : null}
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Step 2 — Distribuição ─────────────────────────────────────────────────────

  const renderStep2 = () => {
    const MODES: {
      key: AssignmentMode;
      icon: React.ElementType;
      label: string;
      desc: string;
    }[] = [
      {
        key: 'auto',
        icon: Shuffle,
        label: 'Distribuição automática',
        desc: 'Consultor atribuído pela regra de distribuição configurada',
      },
      {
        key: 'manual',
        icon: UserCheck,
        label: 'Escolher consultor',
        desc: 'Selecione o consultor manualmente',
      },
    ];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {MODES.map(({ key, icon: Icon, label, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  assignmentMode: key,
                  selectedConsultor: key === 'auto' ? null : prev.selectedConsultor,
                }))
              }
              className={cn(
                'p-4 rounded-[4px] border text-left transition-colors',
                state.assignmentMode === key
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-muted',
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 mb-2.5',
                  state.assignmentMode === key ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <p className="text-sm font-semibold leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</p>
            </button>
          ))}
        </div>

        {/* Manual: consultant list */}
        {state.assignmentMode === 'manual' && (
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-0.5">
            {consultores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum consultor ativo encontrado
              </p>
            ) : (
              consultores.map((c) => {
                const isSelected = state.selectedConsultor?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        selectedConsultor: { id: c.id, nome: c.name, email: c.email || undefined },
                      }))
                    }
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-[4px] border flex items-center gap-3 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-muted',
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.email && (
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Auto: confirmation chip */}
        {state.assignmentMode === 'auto' && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[4px] border border-primary/30 bg-primary/5 text-xs text-primary">
            <Shuffle className="w-3.5 h-3.5 shrink-0" />
            <span>O consultor será atribuído automaticamente na confirmação</span>
          </div>
        )}
      </div>
    );
  };

  // ── Step 3 — Agenda ───────────────────────────────────────────────────────────

  const renderStep3 = () => {
    const isAuto = state.assignmentMode === 'auto';
    const isLoadingSlots = isAuto ? isLoadingAutoSlots : false;

    const slotsByPeriod = {
      manha: slotsForSelectedDate.filter((s) => {
        const h = parseInt(s.start.split(':')[0]);
        return h >= 6 && h < 12;
      }),
      tarde: slotsForSelectedDate.filter((s) => {
        const h = parseInt(s.start.split(':')[0]);
        return h >= 12 && h < 18;
      }),
      noite: slotsForSelectedDate.filter((s) => {
        const h = parseInt(s.start.split(':')[0]);
        return h >= 18 && h < 24;
      }),
    };

    const periodLabels: Record<string, string> = {
      manha: 'Manhã',
      tarde: 'Tarde',
      noite: 'Noite',
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Duração</p>
            <div className="flex gap-1.5 flex-wrap">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      selectedDuration: opt.value,
                      selectedTimeSlot: null,
                    }))
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-[4px] border font-medium transition-colors',
                    state.selectedDuration === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <p className="text-xs font-medium text-muted-foreground mb-2">Data</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'w-full justify-start text-left font-normal text-xs h-8',
                !state.selectedDate && 'text-muted-foreground',
              )}
              onClick={() => setCalendarOpen((prev) => !prev)}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {state.selectedDate
                ? format(state.selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecionar data'}
            </Button>
            {calendarOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 rounded-[4px] border bg-popover shadow-md">
                <Calendar
                  mode="single"
                  selected={state.selectedDate}
                  onSelect={(date) => {
                    setState((prev) => ({ ...prev, selectedDate: date, selectedTimeSlot: null }));
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </div>
            )}
          </div>
        </div>

        {state.selectedDate && (
          <div className="space-y-3">
            {isLoadingSlots ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Carregando horários disponíveis...</p>
              </div>
            ) : slotsForSelectedDate.length === 0 ? (
              <div className="space-y-2 p-3 bg-muted rounded-[4px] border border-border">
                {!isUserType && (
                  <p className="text-xs text-muted-foreground text-center">Sem horários na agenda — insira manualmente:</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">{isUserType ? 'Horário de início' : 'Início'}</Label>
                    <input
                      type="time"
                      className="w-full h-8 text-xs border border-border rounded-[4px] bg-background px-2 mt-0.5"
                      onChange={(e) => {
                        const start = e.target.value;
                        if (!start) return;
                        setState((prev) => ({
                          ...prev,
                          selectedTimeSlot: {
                            start,
                            end: prev.selectedTimeSlot?.end ?? '',
                          },
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">{isUserType ? 'Horário de fim' : 'Fim'}</Label>
                    <input
                      type="time"
                      className="w-full h-8 text-xs border border-border rounded-[4px] bg-background px-2 mt-0.5"
                      onChange={(e) => {
                        const end = e.target.value;
                        if (!end) return;
                        setState((prev) => ({
                          ...prev,
                          selectedTimeSlot: {
                            start: prev.selectedTimeSlot?.start ?? '',
                            end,
                          },
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              (['manha', 'tarde', 'noite'] as const).map((period) => {
                const slots = slotsByPeriod[period];
                if (!slots.length) return null;
                return (
                  <div key={period}>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      {periodLabels[period]}
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {slots.map((slot, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setState((prev) => ({ ...prev, selectedTimeSlot: slot }))
                          }
                          className={cn(
                            'py-2 text-xs rounded-[4px] border font-medium text-center transition-colors',
                            state.selectedTimeSlot?.start === slot.start
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border hover:bg-muted text-foreground',
                          )}
                        >
                          {slot.start.slice(0, 5)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {!state.selectedDate && (
          <div className="text-center py-8 bg-muted rounded-[4px] border border-border border-dashed">
            <CalendarIcon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Selecione uma data para ver os horários disponíveis
            </p>
          </div>
        )}

        {/* Meeting type */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Tipo de Reunião</Label>
          <Select
            value={state.meetingType}
            onValueChange={(v) => setState((prev) => ({ ...prev, meetingType: v as MeetingType }))}
          >
            <SelectTrigger className="h-8 text-xs rounded-[4px]">
              <SelectValue placeholder="Selecionar tipo..." />
            </SelectTrigger>
            <SelectContent className="rounded-[4px]">
              {MEETING_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Optional details (collapsible) */}
        <div className="rounded-[4px] border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <span className="font-medium">Detalhes opcionais</span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', showDetails && 'rotate-180')}
            />
          </button>
          {showDetails && (
            <div className="px-3 pb-3 pt-3 space-y-3 border-t border-border">
              <div>
                <Label className="text-xs text-muted-foreground">Local</Label>
                <Input
                  placeholder="Ex.: Online, Escritório..."
                  value={state.location}
                  onChange={(e) => setState((prev) => ({ ...prev, location: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <Input
                  placeholder="Observações sobre a reunião..."
                  value={state.notes}
                  onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Main ──────────────────────────────────────────────────────────────────────

  const isPending = criarAgendamento.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Nova reunião</DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="py-1">
          {state.step === 1 && renderStep1()}
          {state.step === 2 && renderStep2()}
          {state.step === 3 && renderStep3()}
        </div>

        {/* Compact context bar */}
        {(state.selectedLead || state.selectedConsultor) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground bg-muted border border-border rounded-[4px] px-3 py-2 mt-1">
            {state.selectedLead && (
              <span>
                <strong className="text-foreground font-medium">Cliente:</strong>{' '}
                {state.selectedLead.clientName}
              </span>
            )}
            {state.assignmentMode === 'auto' && (
              <span>
                <strong className="text-foreground font-medium">Atribuição:</strong> Automática
              </span>
            )}
            {state.selectedConsultor && (
              <span>
                <strong className="text-foreground font-medium">Consultor:</strong>{' '}
                {state.selectedConsultor.nome}
              </span>
            )}
            {state.selectedDate && (
              <span>
                <strong className="text-foreground font-medium">Data:</strong>{' '}
                {format(state.selectedDate, 'dd/MM')}
              </span>
            )}
            {state.selectedTimeSlot && (
              <span>
                <strong className="text-foreground font-medium">Horário:</strong>{' '}
                {state.selectedTimeSlot.start.slice(0, 5)}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t mt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs h-8">
            Cancelar
          </Button>
          <div className="flex gap-2">
            {state.step > 1 && !(initialLead && (state.step === 2 || (isUserType && state.step === 3))) && (
              <Button variant="outline" size="sm" onClick={handleBack} className="text-xs h-8">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Voltar
              </Button>
            )}
            {state.step < 3 ? (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canAdvance()}
                className="text-xs h-8"
              >
                Continuar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!canAdvance() || isPending}
                className="text-xs h-8"
              >
                {isPending ? 'Agendando...' : 'Confirmar reunião'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovaReuniaoWizardModal;
