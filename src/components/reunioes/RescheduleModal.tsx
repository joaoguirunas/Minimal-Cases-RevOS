import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConsultorDisponibilidade } from '@/hooks/useConsultorDisponibilidade';
import { useUpdateAgendamento } from '@/hooks/useAgendamentos';
import { useQueryClient } from '@tanstack/react-query';

interface RescheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  consultorId: string;
  leadsId: string;
  duration?: number;
  onSuccess?: () => void;
}

const formatSlot = (time: string) => time.slice(0, 5);

const getTodayStr = () => {
  const d = new Date();
  return d.toLocaleDateString('sv');
};

export const RescheduleModal = ({
  open,
  onOpenChange,
  meetingId,
  consultorId,
  leadsId,
  duration = 60,
  onSuccess,
}: RescheduleModalProps) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);

  const { data: slots = [], isLoading: loadingSlots } = useConsultorDisponibilidade({
    consultorId,
    date: selectedDate,
    duration,
  });

  const updateMutation = useUpdateAgendamento();

  const availableSlots = slots.filter(s => s.available);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;

    const startTimestamp = new Date(`${selectedDate}T${selectedSlot.start}`).toISOString();
    const endTimestamp = new Date(`${selectedDate}T${selectedSlot.end}`).toISOString();

    await updateMutation.mutateAsync({
      id: meetingId,
      start_time: startTimestamp,
      end_time: endTimestamp,
      status: 'agendado',
    });

    queryClient.invalidateQueries({ queryKey: ['meeting-single', meetingId] });
    onSuccess?.();
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedDate('');
    setSelectedSlot(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-[4px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Re-agendar Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Nova Data
            </Label>
            <Input
              type="date"
              value={selectedDate}
              min={getTodayStr()}
              onChange={e => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
              className="h-[30px] text-sm rounded-[4px]"
            />
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Horários Disponíveis
              </Label>

              {loadingSlots && (
                <p className="text-xs text-muted-foreground py-3 text-center">Carregando horários...</p>
              )}

              {!loadingSlots && availableSlots.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-[2px] bg-muted border border-border">
                  <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum horário disponível para esta data.
                  </p>
                </div>
              )}

              {!loadingSlots && availableSlots.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {availableSlots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSlot({ start: slot.start, end: slot.end })}
                      className={cn(
                        'h-[30px] rounded-[4px] text-xs font-medium border transition-colors',
                        selectedSlot?.start === slot.start
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted border-border text-foreground hover:bg-muted hover:border-border'
                      )}
                    >
                      {formatSlot(slot.start)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedDate && selectedSlot && (
            <div className="rounded-[2px] bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-medium text-primary">
                Novo agendamento: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} — {formatSlot(selectedSlot.start)} às {formatSlot(selectedSlot.end)}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={handleClose} className="h-[30px] px-3 text-xs rounded-[4px]">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedSlot || updateMutation.isPending}
            className="h-[30px] px-4 text-xs rounded-[4px]"
          >
            {updateMutation.isPending ? 'Confirmando...' : 'Confirmar re-agendamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
