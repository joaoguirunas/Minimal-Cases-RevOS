import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Save, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useUsuarios } from '@/hooks/useUsuarios';
import { AgendamentoSimple } from '@/hooks/useAgendamentosSimple';
import MultiSelectPessoas from '@/components/common/MultiSelectPessoas';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Gerar horários disponíveis de 08:00 até 18:00 em intervalos de 30 minutos
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 18 && minute > 0) break; // Parar em 18:00
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

interface EditarReuniaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento?: AgendamentoSimple;
}

const EditarReuniaoModal: React.FC<EditarReuniaoModalProps> = ({
  open,
  onOpenChange,
  agendamento,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [consultorId, setConsultorId] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [status, setStatus] = useState('agendado');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState('');
  const [googleMeetLink, setGoogleMeetLink] = useState('');
  
  const { usuarios = [], isLoading: isLoadingUsuarios } = useUsuarios();

  useEffect(() => {
    if (agendamento) {
      setDate(agendamento.date);
      const extractTime = (ts: string) => ts?.includes('T') ? ts.split('T')[1]?.slice(0, 5) : ts?.slice(0, 5);
      setStartTime(extractTime(agendamento.hora_inicio || agendamento.start_time) || '');
      setEndTime(extractTime(agendamento.hora_fim || agendamento.end_time) || '');
      setNotes(agendamento.notes || '');
      setConsultorId(agendamento.user_id || '');
      setAttendees(agendamento.attendees || []);
      setStatus(agendamento.status || 'agendado');
      setQuantity(String(agendamento.quantity || 1));
      setLocation(agendamento.location || '');
      setGoogleMeetLink(agendamento.google_meet_link || '');
    }
  }, [agendamento]);

  const handleSubmit = async () => {
    if (!agendamento) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          start_time: startTime + ':00',
          end_time: endTime + ':00',
          notes,
          user_id: consultorId || null,
          attendees,
          status,
          quantity: quantity ? parseInt(quantity) : null,
          location,
          google_meet_link: googleMeetLink || null,
        })
        .eq('id', agendamento.id);

      if (error) throw error;

      toast.success('Reunião atualizada com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar reunião:', error);
      toast.error('Erro ao atualizar reunião');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!agendamento) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', agendamento.id);

      if (error) throw error;

      toast.success('Reunião excluída com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao excluir reunião:', error);
      toast.error('Erro ao excluir reunião');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Reunião</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="border border-border rounded-[2px]">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data da Reunião *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label>Horário *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Início
                        </Label>
                        <div className="grid grid-cols-4 gap-2 max-h-[180px] overflow-y-auto p-2 border border-border rounded-[4px] bg-muted">
                          {TIME_SLOTS.map((time) => (
                            <Button
                              key={`start-${time}`}
                              type="button"
                              variant={startTime === time ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-8 text-xs rounded-[4px]",
                                startTime === time && "ring-2 ring-primary ring-offset-1"
                              )}
                              onClick={() => setStartTime(time)}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Fim
                        </Label>
                        <div className="grid grid-cols-4 gap-2 max-h-[180px] overflow-y-auto p-2 border border-border rounded-[4px] bg-muted">
                          {TIME_SLOTS.map((time) => (
                            <Button
                              key={`end-${time}`}
                              type="button"
                              variant={endTime === time ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-8 text-xs rounded-[4px]",
                                endTime === time && "ring-2 ring-primary ring-offset-1"
                              )}
                              onClick={() => setEndTime(time)}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="consultor">Consultor</Label>
                    <Select value={consultorId} onValueChange={setConsultorId}>
                      <SelectTrigger id="consultor" className="rounded-[4px]" disabled={isLoadingUsuarios}>
                        <SelectValue placeholder={isLoadingUsuarios ? "Carregando..." : "Selecione o consultor"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-[4px]">
                        {usuarios.map((usuario: { id: string; nome?: string; name?: string }) => (
                          <SelectItem key={usuario.id} value={usuario.id} className="rounded-[4px]">
                            {usuario.nome || usuario.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="status" className="rounded-[4px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-[4px]">
                        <SelectItem value="agendado" className="rounded-[4px]">Agendada</SelectItem>
                        <SelectItem value="compareceu" className="rounded-[4px]">Compareceu</SelectItem>
                        <SelectItem value="nao-compareceu" className="rounded-[4px]">Não compareceu</SelectItem>
                        <SelectItem value="cancelado" className="rounded-[4px]">Cancelada</SelectItem>
                        <SelectItem value="bloqueio manual" className="rounded-[4px]">Bloqueio Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="convidados">Participantes</Label>
                  <MultiSelectPessoas
                    selectedPessoas={attendees}
                    onPessoasChange={setAttendees}
                    tenantId=""
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantidade</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Local</Label>
                    <Input
                      id="location"
                      type="text"
                      placeholder="Local da reunião"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="googleMeet">Link Google Meet</Label>
                  <Input
                    id="googleMeet"
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={googleMeetLink}
                    onChange={(e) => setGoogleMeetLink(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Adicione observações sobre a reunião..."
                    className="min-h-[100px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
            
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditarReuniaoModal;
