import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCriarAgendamento } from '@/hooks/useAgendamentos';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock } from 'lucide-react';

interface CriarAgendamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  pessoaNome?: string;
}

const CriarAgendamentoModal = ({ open, onOpenChange, pessoaId, pessoaNome }: CriarAgendamentoModalProps) => {
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('10:00');
  const [duracao, setDuracao] = useState('30'); // em minutos
  const [local, setLocal] = useState('');
  const [sendConfirmation, setSendConfirmation] = useState(true);

  const criarAgendamento = useCriarAgendamento();
  const { user } = useAuth();

  const handleCreate = async () => {
    if (!titulo.trim() || !data || !horaInicio) {
      alert('Preencha título, data e hora');
      return;
    }

    try {
      const endDate = new Date(`${data}T${horaInicio}`);
      endDate.setMinutes(endDate.getMinutes() + parseInt(duracao));
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      let resolvedLeadId: string | null = null;
      if (pessoaId) {
        const { data: leadRow } = await supabase
          .from('leads')
          .select('id')
          .eq('people_id', pessoaId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedLeadId = leadRow?.id ?? null;
      }

      await criarAgendamento.mutateAsync({
        people_id: pessoaId,
        lead_id: resolvedLeadId,
        user_id: user?.id ?? null,
        title: titulo.trim(),
        location: local.trim(),
        date: data,
        start_time: horaInicio,
        end_time: endTime,
        sendConfirmation,
      });

      // Reset form
      setTitulo('');
      setData('');
      setHoraInicio('10:00');
      setDuracao('30');
      setLocal('');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px]">
            Novo agendamento {pessoaNome && `com ${pessoaNome}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
              Assunto *
            </label>
            <Input
              placeholder="Ex: Reunião comercial, Follow-up, etc"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="h-8 text-[13px]"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Data *
              </label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="h-8 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Hora *
              </label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="h-8 text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
              Duração (minutos)
            </label>
            <Input
              type="number"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              className="h-8 text-[13px]"
              min="5"
              step="5"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">
              Local / Link
            </label>
            <Input
              placeholder="Ex: Escritório, Zoom, etc"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="h-8 text-[13px]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sendConfirmationConversas"
              checked={sendConfirmation}
              onChange={(e) => setSendConfirmation(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <label htmlFor="sendConfirmationConversas" className="text-[12px] text-muted-foreground cursor-pointer">
              Enviar confirmação por WhatsApp
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-[12px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={criarAgendamento.isPending || !titulo.trim() || !data}
            className="h-8 text-[12px]"
          >
            {criarAgendamento.isPending ? 'Criando...' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CriarAgendamentoModal;
