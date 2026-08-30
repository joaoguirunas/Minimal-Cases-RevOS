import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, User, ExternalLink, Trash2, RefreshCcw,
  Video, Plus, Building2, Phone, Mail, Star, Edit3, Check, X, CalendarCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useNavigation } from '@/contexts/NavigationContext';
import { useQueryClient } from '@tanstack/react-query';
import { useMeetingSingle } from '@/hooks/useMeetingSingle';
import { useMeetingRecords } from '@/hooks/useMeetingRecords';
import { useUpdateAgendamento, useDeleteAgendamento } from '@/hooks/useAgendamentos';
import { MeetingRecordCard } from '@/components/reunioes/MeetingRecordCard';
import { AddMeetingRecordModal } from '@/components/reunioes/AddMeetingRecordModal';
import { RescheduleModal } from '@/components/reunioes/RescheduleModal';
import { ConfirmarExclusaoModal } from '@/components/modals/ConfirmarExclusaoModal';

const STATUS_BADGE: Record<string, string> = {
  agendado:          'text-blue-600 bg-blue-500/8 border-blue-500/20',
  compareceu:        'text-emerald-600 bg-emerald-500/8 border-emerald-500/20',
  nao_compareceu:    'text-amber-600 bg-amber-500/8 border-amber-500/20',
  'bloqueio manual': 'text-muted-foreground bg-muted border-border',
  cancelado:         'text-rose-600 bg-rose-500/8 border-rose-500/20',
};

const STATUS_ACCENT: Record<string, string> = {
  agendado:          'bg-blue-500',
  compareceu:        'bg-emerald-500',
  nao_compareceu:    'bg-amber-500',
  'bloqueio manual': 'bg-muted-foreground/40',
  cancelado:         'bg-rose-500',
};

const STATUS_OPTIONS = [
  { value: 'agendado',        label: 'Agendada' },
  { value: 'compareceu',      label: 'Compareceu' },
  { value: 'nao_compareceu',  label: 'Não compareceu' },
  { value: 'cancelado',       label: 'Cancelada' },
  { value: 'bloqueio manual', label: 'Bloqueio manual' },
];

const OUTCOME_OPTIONS = [
  { value: 'none',           label: 'Sem resultado' },
  { value: 'venda',          label: 'Venda' },
  { value: 'follow_up',      label: 'Follow-up' },
  { value: 'sem_interesse',  label: 'Sem interesse' },
  { value: 'reagendada',     label: 'Reagendada' },
  { value: 'nao_compareceu', label: 'Não compareceu' },
];

const formatDateTime = (iso?: string | null) => {
  if (!iso) return { date: '—', time: '—' };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
};

const extractTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const extractDate = (iso?: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv');
};

const getDurationMin = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / 60000);
};

const GOOGLE_CAL_URL = (eventId: string) =>
  `https://calendar.google.com/calendar/event?eid=${btoa(`${eventId} primary`)}`;

const ReuniaoSingle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setNavigationState, clearNavigationState } = useNavigation();

  const { data: meeting, isLoading, error } = useMeetingSingle(id || '');
  const { data: records = [], isLoading: loadingRecords } = useMeetingRecords(id || '');

  const updateMutation = useUpdateAgendamento();
  const deleteMutation = useDeleteAgendamento();

  const [isEditing, setIsEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  // Optimistic status — updates immediately in UI, reverts on error
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const displayStatus = localStatus ?? meeting?.status ?? '';

  // Edit state
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editOutcome, setEditOutcome] = useState('none');
  const [editMeetLink, setEditMeetLink] = useState('');

  // NOTA: guard client-side por user_id===currentUserId removido — mesmo
  // problema já corrigido em NegocioSingle.tsx (RLS users_read_own_meetings/
  // users_manage_own_meetings já cobre acesso por pipeline-via-equipe no
  // banco; reconferir no client com um critério mais estrito e desatualizado
  // só barrava reunião legítima e corrompia o histórico de navegação).

  // Populate edit state when meeting loads
  useEffect(() => {
    if (meeting) {
      setEditDate(extractDate(meeting.start_time));
      setEditStartTime(extractTime(meeting.start_time));
      setEditEndTime(extractTime(meeting.end_time));
      setEditLocation(meeting.location || '');
      setEditNotes(meeting.notes || '');
      setEditStatus(meeting.status || '');
      setEditOutcome(meeting.outcome || 'none');
      setEditMeetLink(meeting.meeting_link || '');
      // Sync optimistic state once we get real data (unless actively changing)
      setLocalStatus(null);
    }
  }, [meeting]);

  // Set navigation context for back button
  useEffect(() => {
    const clientName = meeting?.leads?.clients_people?.name;
    setNavigationState({
      showBackButton: true,
      leadName: clientName ? `Reunião — ${clientName}` : 'Reunião',
      onBack: () => navigate('/schedule'),
    });
    return () => clearNavigationState();
  }, [meeting, setNavigationState, clearNavigationState, navigate]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    const prev = localStatus ?? meeting?.status ?? '';
    setLocalStatus(newStatus); // optimistic update
    try {
      await updateMutation.mutateAsync({ id, status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['meeting-single', id] });
    } catch {
      setLocalStatus(prev); // revert on error
    }
  };

  const handleSaveEdits = async () => {
    if (!id || !editDate) return;
    try {
      const startTimestamp = new Date(`${editDate}T${editStartTime || '00:00'}`).toISOString();
      const endTimestamp = new Date(`${editDate}T${editEndTime || '01:00'}`).toISOString();

      await updateMutation.mutateAsync({
        id,
        start_time: startTimestamp,
        end_time: endTimestamp,
        location: editLocation || undefined,
        notes: editNotes || undefined,
        status: editStatus || undefined,
        google_meet_link: editMeetLink || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['meeting-single', id] });
      setIsEditing(false);
    } catch {
      // error handled in hook
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/schedule');
    } catch {
      // error handled in hook
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 p-6">
        <CalendarCheck className="w-12 h-12 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold text-foreground">Reunião não encontrada</h3>
        <p className="text-sm text-muted-foreground">Esta reunião não existe ou você não tem acesso.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/schedule')} className="rounded-[2px]">
          <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
          Voltar às Reuniões
        </Button>
      </div>
    );
  }

  const clientName = meeting.leads?.clients_people?.name || '—';
  const clientWhatsapp = meeting.leads?.clients_people?.whatsapp;
  const clientEmail = meeting.leads?.clients_people?.email;
  const clientScore = meeting.leads?.clients_people?.score;
  const consultorName = meeting.settings_users?.name || '—';
  const lead = meeting.leads;

  const startDt = formatDateTime(meeting.start_time);
  const durationMin = getDurationMin(meeting.start_time, meeting.end_time);
  const canReschedule = displayStatus === 'cancelado' || displayStatus === 'nao_compareceu';

  return (
    <div className="flex flex-col bg-background">
      {/* ── Top action bar ───────────────────────────────────── */}
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dropdown — uses optimistic displayStatus so it updates immediately */}
          <Select value={displayStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className={cn(
              'h-[30px] w-auto min-w-[130px] text-xs rounded-[2px] border font-medium',
              STATUS_BADGE[displayStatus] || 'text-muted-foreground bg-muted border-border'
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[2px] text-xs">
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Re-agendar */}
          {canReschedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReschedule(true)}
              className="h-[30px] px-2.5 text-xs rounded-[2px] gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Re-agendar
            </Button>
          )}

          {/* Open in Google Calendar */}
          {meeting.google_event_id && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-[30px] w-[30px] p-0 rounded-[2px] text-muted-foreground"
            >
              <a
                href={GOOGLE_CAL_URL(meeting.google_event_id)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no Google Calendar"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}

          {/* Open in Microsoft Teams */}
          {meeting.ms_meeting_id && meeting.meeting_link && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-[30px] px-2 rounded-[2px] text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-500/8 gap-1"
            >
              <a
                href={meeting.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no Microsoft Teams"
              >
                <Video className="w-3.5 h-3.5" />
                Teams
              </a>
            </Button>
          )}

          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDelete(true)}
            className="h-[30px] w-[30px] p-0 rounded-[2px] text-muted-foreground hover:text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Header card (hero) ──────────────────────────────── */}
      <div className="mx-6 mt-6 mb-0 border border-border bg-card rounded-md overflow-hidden flex">
        {/* Status accent bar */}
        <div className={cn("w-1 shrink-0", STATUS_ACCENT[displayStatus] || 'bg-muted')} />
        <div className="flex items-start gap-4 p-6 flex-1 min-w-0">
          <div className="p-3 bg-primary/10 rounded-md shrink-0">
            <CalendarCheck className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Reunião
              </p>
              <h1 className="text-xl font-semibold text-foreground leading-tight truncate">
                {meeting.title || clientName}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {startDt.date}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-1.5 font-mono tabular-nums">
                <Clock className="w-3.5 h-3.5" />
                {startDt.time} – {formatDateTime(meeting.end_time).time}
                {durationMin && <span className="text-muted-foreground/60 ml-1">({durationMin}min)</span>}
              </span>
              {consultorName !== '—' && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {consultorName}
                  </span>
                </>
              )}
              {meeting.location && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {meeting.location}
                  </span>
                </>
              )}
              {lead && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <button
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    onClick={() => navigate(`/crm/kanban/${lead.id}`)}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {lead.title || 'Ver negócio'}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <Tabs defaultValue="detalhes" className="flex flex-col flex-1 mx-6 mt-4 mb-6">
        <div className="border-b border-border">
          <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none">
            {[
              { value: 'detalhes', label: 'Detalhes' },
              { value: 'registros', label: `Registros${records.length > 0 ? ` (${records.length})` : ''}` },
              { value: 'relacionado', label: 'Relacionado' },
            ].map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-1.5 px-4 py-3 h-auto text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Tab: Detalhes ─────────────────────────────────── */}
        <TabsContent value="detalhes" className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Informações da reunião</h2>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-[30px] px-2.5 text-xs rounded-[2px] gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-[30px] px-2.5 text-xs rounded-[2px]">
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveEdits} disabled={updateMutation.isPending} className="h-[30px] px-3 text-xs rounded-[2px]">
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-[2px] flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs text-primary font-medium">Modo de edição ativo — salve para confirmar as alterações</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
            {/* Left column */}
            <div className="space-y-6">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Data e Horário</p>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Data da Reunião</Label>
                {isEditing ? (
                  <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-[30px] text-xs rounded-[2px]" />
                ) : (
                  <p className="text-sm text-foreground">{startDt.date}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Início</Label>
                  {isEditing ? (
                    <Input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="h-[30px] text-xs rounded-[2px]" />
                  ) : (
                    <p className="text-sm text-foreground font-mono">{formatDateTime(meeting.start_time).time}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Fim</Label>
                  {isEditing ? (
                    <Input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className="h-[30px] text-xs rounded-[2px]" />
                  ) : (
                    <p className="text-sm text-foreground font-mono">{formatDateTime(meeting.end_time).time}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Local</Label>
                {isEditing ? (
                  <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Endereço ou local" className="h-[30px] text-xs rounded-[2px]" />
                ) : (
                  <p className="text-sm text-foreground">{meeting.location || <span className="text-muted-foreground">—</span>}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Link Google Meet</Label>
                {isEditing ? (
                  <Input value={editMeetLink} onChange={e => setEditMeetLink(e.target.value)} placeholder="https://meet.google.com/..." className="h-[30px] text-xs rounded-[2px]" />
                ) : meeting.meeting_link ? (
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Video className="w-3.5 h-3.5" />
                    {meeting.meeting_link}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Resultado</Label>
                {isEditing ? (
                  <Select value={editOutcome} onValueChange={setEditOutcome}>
                    <SelectTrigger className="h-[30px] text-xs rounded-[2px]"><SelectValue placeholder="Selecionar resultado..." /></SelectTrigger>
                    <SelectContent className="rounded-[2px] text-xs">
                      {OUTCOME_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground capitalize">{meeting.outcome?.replace('_', ' ') || <span className="text-muted-foreground">—</span>}</p>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Consultor e Status</p>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Consultor</Label>
                <p className="text-sm text-foreground">{consultorName}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Status</Label>
                {isEditing ? (
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-[30px] text-xs rounded-[2px]"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-[2px] text-xs">
                      {STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-[2px] text-[11px] font-medium border', STATUS_BADGE[displayStatus] || 'text-muted-foreground bg-muted border-border')}>
                    {displayStatus}
                  </span>
                )}
              </div>

              {meeting.quantity != null && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Participantes</Label>
                  <p className="text-sm text-foreground">{meeting.quantity}</p>
                </div>
              )}

              <div className="pt-2 border-t border-border space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Observações</p>
                {isEditing ? (
                  <Textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Observações sobre a reunião..."
                    className="min-h-[100px] text-sm rounded-[2px] resize-none"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {meeting.notes || 'Sem observações.'}
                  </p>
                )}
              </div>

            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Registros ────────────────────────────────── */}
        <TabsContent value="registros" className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Registros da reunião
              {records.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({records.length})</span>}
            </h2>
            <Button size="sm" onClick={() => setShowAddRecord(true)} className="h-[30px] px-2.5 text-xs rounded-[2px] gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Adicionar Registro
            </Button>
          </div>

          {loadingRecords ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-[2px]" />
              <Skeleton className="h-32 w-full rounded-[2px]" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <CalendarCheck className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">Sem registros ainda</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Adicione gravações, transcrições, resumos ou análises de IA desta reunião.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowAddRecord(true)} className="rounded-[2px] h-[30px] text-xs mt-1 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Adicionar primeiro registro
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map(record => (
                <MeetingRecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Relacionado ──────────────────────────────── */}
        <TabsContent value="relacionado" className="pt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
            {/* Negócio */}
            <div className="space-y-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Negócio</p>
              {lead ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground leading-snug">{lead.title || '—'}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/crm/kanban/${lead.id}`)}
                      className="h-[30px] px-2 text-xs rounded-[2px] gap-1 text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver
                    </Button>
                  </div>
                  {lead.value != null && (
                    <p className="text-sm text-muted-foreground">
                      Valor: <span className="font-medium text-foreground">{
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value)
                      }</span>
                    </p>
                  )}
                  {lead.status && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-[11px] font-medium bg-muted text-muted-foreground">
                      {lead.status}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum negócio associado</p>
              )}
            </div>

            {/* Cliente */}
            <div className="space-y-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cliente</p>
              {clientName !== '—' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{clientName}</p>
                    {clientScore != null && (
                      <div className="flex items-center gap-1 text-xs text-amber-500 shrink-0">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="font-semibold">{clientScore}</span>
                      </div>
                    )}
                  </div>
                  {clientWhatsapp && (
                    <a
                      href={`https://wa.me/${clientWhatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      {clientWhatsapp}
                    </a>
                  )}
                  {clientEmail && (
                    <a
                      href={`mailto:${clientEmail}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      {clientEmail}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum cliente associado</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modals ───────────────────────────────────────────── */}
      <AddMeetingRecordModal
        open={showAddRecord}
        onOpenChange={setShowAddRecord}
        meetingId={id || ''}
      />

      {meeting.user_id && (
        <RescheduleModal
          open={showReschedule}
          onOpenChange={setShowReschedule}
          meetingId={id || ''}
          consultorId={meeting.user_id}
          leadsId={meeting.lead_id}
          duration={durationMin || 60}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['meeting-single', id] })}
        />
      )}

      <ConfirmarExclusaoModal
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        title="Excluir Reunião"
        description={`Tem certeza que deseja excluir esta reunião com "${clientName}"? Esta ação não pode ser desfeita.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default ReuniaoSingle;
