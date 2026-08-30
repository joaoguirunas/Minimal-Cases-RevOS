import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useConsultorDisponibilidade } from '@/hooks/useConsultorDisponibilidade';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { auditLogger } from '@/utils/auditLogger';

interface BloquearAgendaModalProps {
  open: boolean;
  onClose: () => void;
}

export const BloquearAgendaModal = ({ open, onClose }: BloquearAgendaModalProps) => {
  const { user } = useAuth();
  const { isManager } = useUserPermissions();
  const { data: usuarios = [] } = useUsuarios();

  const [formData, setFormData] = useState({
    user_id: (user?.profile?.id as string | undefined) || '',
    date: '',
    time_slots: [] as string[],
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: availableSlots = [], isLoading: isLoadingSlots } = useConsultorDisponibilidade({
    consultorId: formData.user_id,
    date: formData.date,
    duration: 30
  });

  const handleSubmit = async () => {
    if (!formData.date || formData.time_slots.length === 0) {
      toast.error('Preencha a data e selecione ao menos um horário');
      return;
    }

    if (!formData.user_id) {
      toast.error('Selecione o consultor');
      return;
    }

    setIsSubmitting(true);

    try {
      const meetingsToInsert = formData.time_slots.map(timeSlot => {
        const [start, end] = timeSlot.split('-');
        return {
          user_id: formData.user_id,
          start_time: `${formData.date}T${start}:00`,
          end_time: `${formData.date}T${end}:00`,
          notes: formData.notes || 'Bloqueio de agenda',
          status: 'bloqueio manual',
          title: 'Bloqueio de Agenda',
          lead_id: null as string | null
        };
      });

      const { error } = await supabase
        .from('meetings')
        .insert(meetingsToInsert);

      if (error) throw error;

      await auditLogger.log({
        action: 'schedule_blocked',
        resource_type: 'meeting',
        details: {
          user_id: formData.user_id,
          date: formData.date,
          time_slots: formData.time_slots,
          reason: formData.notes
        }
      });

      const count = formData.time_slots.length;
      toast.success(`${count} horário${count > 1 ? 's bloqueados' : ' bloqueado'} com sucesso`);
      handleClose();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao bloquear agenda:', error);
      toast.error(errMsg || 'Erro ao bloquear agenda');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      user_id: (user?.profile?.id as string | undefined) || '',
      date: '',
      time_slots: [],
      notes: ''
    });
    onClose();
  };

  const toggleTimeSlot = (slotValue: string) => {
    setFormData(prev => ({
      ...prev,
      time_slots: prev.time_slots.includes(slotValue)
        ? prev.time_slots.filter(s => s !== slotValue)
        : [...prev.time_slots, slotValue]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Shield className="w-4 h-4 text-primary" />
            Bloquear Agenda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Consultor — só gestor/admin escolhe outra pessoa; comercial/user só bloqueia a própria agenda (RLS já restringe isso no banco, isso é só clareza de UI) */}
          <div>
            <Label htmlFor="user_id">Consultor *</Label>
            {isManager ? (
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="mt-1 rounded-[4px]">
                  <SelectValue placeholder="Selecione o consultor" />
                </SelectTrigger>
                <SelectContent>
                  {(usuarios as Array<{ id: string; nome: string }>).map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={user?.profile?.nome || 'Você'}
                disabled
                className="mt-1 rounded-[4px] text-muted-foreground"
              />
            )}
          </div>

          {/* Data */}
          <div>
            <Label htmlFor="date">Data *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              disabled={isSubmitting}
              className="mt-1 rounded-[4px]"
            />
          </div>

          {/* Horários Disponíveis */}
          {formData.date && formData.user_id && (
            <div>
              <Label>Horários Disponíveis * <span className="text-muted-foreground font-normal">(selecione um ou mais)</span></Label>
              {formData.time_slots.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.time_slots.length} horário{formData.time_slots.length > 1 ? 's selecionados' : ' selecionado'}
                </p>
              )}
              {isLoadingSlots ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  Carregando horários disponíveis...
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="mt-2 p-4 border border-border rounded-[4px] text-center">
                  <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário disponível nesta data
                  </p>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 border border-border rounded-[4px]">
                  {availableSlots.map((slot, index) => {
                    const slotValue = `${slot.start.substring(0, 5)}-${slot.end.substring(0, 5)}`;
                    const isSelected = formData.time_slots.includes(slotValue);
                    const isAvailable = slot.available;

                    return (
                      <Button
                        key={index}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        disabled={!isAvailable || isSubmitting}
                        onClick={() => toggleTimeSlot(slotValue)}
                        className={`h-auto py-2 px-3 rounded-[4px] ${
                          !isAvailable ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium">
                            {slot.start.substring(0, 5)}
                          </span>
                          <Badge
                            variant={isAvailable ? "outline" : "secondary"}
                            className="text-[10px] px-1 h-4"
                          >
                            {isAvailable ? 'Livre' : 'Ocupado'}
                          </Badge>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!formData.date && (
            <div className="text-sm text-muted-foreground">
              Selecione uma data para ver os horários disponíveis
            </div>
          )}

          {/* Motivo */}
          <div>
            <Label htmlFor="notes">Motivo do Bloqueio</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex.: Reunião externa, compromisso pessoal..."
              disabled={isSubmitting}
              className="mt-1 rounded-[4px] min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-[4px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 rounded-[4px]"
          >
            <Shield className="w-4 h-4" />
            {isSubmitting ? 'Bloqueando...' : 'Bloquear Agenda'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BloquearAgendaModal;
