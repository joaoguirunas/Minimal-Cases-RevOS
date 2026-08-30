import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SmartSlotPicker } from '@/components/reunioes/SmartSlotPicker';
import { useCriarAgendamento } from '@/hooks/useAgendamentos';
import { useBookingRuleSets } from '@/hooks/useBookingRuleSets';
import {
  Loader2, CalendarPlus, CheckCircle2, Briefcase, Link2, Copy,
} from 'lucide-react';
import { toast } from 'sonner';

interface AgendamentoInlineTabProps {
  personId: string | null;
  personName: string | null;
  userId: string | null;
  linkedLeadId: string | null;
  onSendLink?: (url: string) => void;
}

export function AgendamentoInlineTab({
  personId, personName, userId, linkedLeadId, onSendLink,
}: AgendamentoInlineTabProps) {
  const criarAgendamento = useCriarAgendamento();
  const { data: ruleSets = [] } = useBookingRuleSets();
  const [title, setTitle]         = useState(`Follow-up — ${personName || 'Cliente'}`);
  const [notes, setNotes]         = useState('');
  const [date, setDate]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [done, setDone]           = useState(false);

  const canCreate = !!date && !!startTime && !!endTime && !!title.trim();

  const activeRuleSet = ruleSets.find(rs => rs.is_active && rs.url_id);
  const bookingUrl = activeRuleSet
    ? `${window.location.origin}/agendar/${activeRuleSet.url_id}`
    : null;

  const handleCreate = () => {
    if (!canCreate || !userId) return;
    criarAgendamento.mutate(
      {
        people_id: personId || undefined,
        lead_id: linkedLeadId || undefined,
        user_id: userId,
        title,
        date,
        start_time: startTime,
        end_time: endTime,
        notes,
        status: 'agendado',
      },
      {
        onSuccess: () => { toast.success('Agendamento criado'); setDone(true); },
        onError: () => toast.error('Erro ao criar agendamento'),
      },
    );
  };

  const handleSendLink = () => {
    if (!bookingUrl) {
      toast.error('Configure um conjunto de regras de agendamento em Configurações');
      return;
    }
    if (onSendLink) {
      onSendLink(bookingUrl);
    } else {
      navigator.clipboard.writeText(bookingUrl);
      toast.success('Link copiado!');
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" strokeWidth={1.5} />
        </div>
        <p className="text-[14px] font-semibold text-foreground">Agendamento criado!</p>
        <p className="text-[12px] text-muted-foreground">O compromisso foi salvo com sucesso</p>
        {linkedLeadId && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Vinculado ao negócio selecionado</p>
        )}
        <Button variant="outline" size="sm" onClick={() => { setDone(false); setDate(''); setStartTime(''); setEndTime(''); }} className="mt-1 h-[30px] text-xs rounded-[4px]">
          Criar outro agendamento
        </Button>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="p-6 text-center text-[13px] text-muted-foreground">
        Usuário não autenticado
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Context */}
      {(personName || linkedLeadId) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-muted border border-white/[0.06] text-[11px]">
          {personName && (
            <span className="text-muted-foreground">Para: <strong className="text-foreground">{personName}</strong></span>
          )}
          {linkedLeadId && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 ml-auto">
              <Briefcase className="w-3 h-3" strokeWidth={1.5} /> Negócio vinculado
            </span>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[10px] text-white/40">Título</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-xs" />
      </div>

      <SmartSlotPicker
        consultorId={userId}
        onSelect={(d, st, et) => { setDate(d); setStartTime(st); setEndTime(et); }}
      />

      <div className="space-y-1">
        <Label className="text-[10px] text-white/40">Notas</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="O que será discutido?"
          rows={2}
          className="text-xs resize-none"
        />
      </div>

      <Button
        onClick={handleCreate}
        disabled={!canCreate || criarAgendamento.isPending}
        className="w-full h-[30px] text-xs rounded-[4px] gap-1.5"
      >
        {criarAgendamento.isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <CalendarPlus className="w-3.5 h-3.5" strokeWidth={1.5} />}
        Confirmar agendamento
      </Button>

      {/* Send booking link */}
      <div className="border-t border-white/[0.06] pt-3">
        <Button
          variant="outline"
          onClick={handleSendLink}
          className="w-full h-[30px] text-xs rounded-[4px] gap-1.5"
        >
          {onSendLink ? (
            <><Link2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Enviar link de agendamento</>
          ) : (
            <><Copy className="w-3.5 h-3.5" strokeWidth={1.5} /> Copiar link de agendamento</>
          )}
        </Button>
        {bookingUrl && (
          <p className="text-[10px] text-white/40 mt-1 text-center truncate" title={bookingUrl}>
            {bookingUrl}
          </p>
        )}
      </div>
    </div>
  );
}
