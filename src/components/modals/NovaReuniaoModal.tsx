import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCriarAgendamento } from '@/hooks/useAgendamentos';
import { useNegocios } from '@/hooks/useNegocios';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NovaReuniaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
  leadId?: string;
}

export const NovaReuniaoModal = ({ open, onOpenChange, onClose, leadId }: NovaReuniaoModalProps) => {
  const [formData, setFormData] = useState({
    lead_id: leadId || '',
    user_id: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    notes: '',
    google_meet_link: '',
    status: 'agendado'
  });

  const [openLeadCombobox, setOpenLeadCombobox] = useState(false);

  const criarAgendamento = useCriarAgendamento();
  const { data: negocios = [] } = useNegocios();
  const { data: usuarios = [] } = useUsuarios();

  useEffect(() => {
    if (leadId) {
      setFormData(prev => ({ ...prev, lead_id: leadId }));
    }
  }, [leadId]);

  const handleSubmit = async () => {
    if (!formData.lead_id || !formData.date || !formData.start_time || !formData.end_time) {
      return;
    }

    const payload = {
      ...formData,
      user_id: formData.user_id === 'none' || !formData.user_id ? null : formData.user_id,
    };

    await criarAgendamento.mutateAsync(payload);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      lead_id: leadId || '',
      user_id: '',
      date: '',
      start_time: '',
      end_time: '',
      location: '',
      notes: '',
      google_meet_link: '',
      status: 'agendado'
    });
    onOpenChange(false);
    onClose?.();
  };

  const isLoading = criarAgendamento.isPending;
  const selectedLead = negocios.find(n => n.id === formData.lead_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">New Meeting</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead Selection */}
          <div>
            <Label htmlFor="lead_id" className="text-sm font-medium text-foreground">Lead *</Label>
            <Popover open={openLeadCombobox} onOpenChange={setOpenLeadCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openLeadCombobox}
                  className="w-full justify-between border-border h-10 mt-2 rounded-[4px]"
                  disabled={isLoading || !!leadId}
                >
                  {selectedLead
                    ? `${selectedLead.titulo || 'Untitled'} - ${selectedLead.pessoa?.nome || 'No client'}`
                    : "Select lead..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 rounded-[4px]">
                <Command>
                  <CommandInput placeholder="Search lead..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No lead found.</CommandEmpty>
                    <CommandGroup>
                      {negocios.map((negocio) => (
                        <CommandItem
                          key={negocio.id}
                          value={negocio.titulo || negocio.id}
                          onSelect={() => {
                            setFormData(prev => ({ ...prev, lead_id: negocio.id }));
                            setOpenLeadCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.lead_id === negocio.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-foreground">{negocio.titulo || 'Untitled'}</span>
                            <span className="text-xs text-muted-foreground">
                              {negocio.pessoa?.nome || 'No client'}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="date" className="text-sm font-medium text-foreground">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                disabled={isLoading}
                className="border-border h-10 mt-2 rounded-[4px]"
              />
            </div>
            <div>
              <Label htmlFor="start_time" className="text-sm font-medium text-foreground">Start Time *</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                disabled={isLoading}
                className="border-border h-10 mt-2 rounded-[4px]"
              />
            </div>
            <div>
              <Label htmlFor="end_time" className="text-sm font-medium text-foreground">End Time *</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                disabled={isLoading}
                className="border-border h-10 mt-2 rounded-[4px]"
              />
            </div>
          </div>

          {/* Consultant */}
          <div>
            <Label htmlFor="user_id" className="text-sm font-medium text-foreground">Consultant</Label>
            <Select
              value={formData.user_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}
              disabled={isLoading}
            >
              <SelectTrigger className="border-border h-10 mt-2 rounded-[4px]">
                <SelectValue placeholder="Select consultant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No consultant</SelectItem>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Meeting location or link"
              disabled={isLoading}
              className="border-border h-10 mt-2 rounded-[4px]"
            />
          </div>

          {/* Google Meet Link */}
          <div>
            <Label htmlFor="googleMeetLink" className="text-sm font-medium text-foreground">Google Meet Link</Label>
            <Input
              id="googleMeetLink"
              type="url"
              value={formData.google_meet_link}
              onChange={(e) => setFormData(prev => ({ ...prev, google_meet_link: e.target.value }))}
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              disabled={isLoading}
              className="border-border h-10 mt-2 rounded-[4px]"
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status" className="text-sm font-medium text-foreground">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              disabled={isLoading}
            >
              <SelectTrigger className="border-border h-10 mt-2 rounded-[4px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agendado">Scheduled</SelectItem>
                <SelectItem value="cancelado">Cancelled</SelectItem>
                <SelectItem value="reagendado">Rescheduled</SelectItem>
                <SelectItem value="realizado">Completed</SelectItem>
                <SelectItem value="compareceu">Attended</SelectItem>
                <SelectItem value="nao_compareceu">Did not attend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium text-foreground">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Meeting notes..."
              rows={3}
              disabled={isLoading}
              className="border-border mt-2 rounded-[4px]"
            />
          </div>

          {/* WhatsApp Confirmation */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sendConfirmation"
              checked={formData.sendConfirmation || false}
              onChange={(e) => setFormData(prev => ({ ...prev, sendConfirmation: e.target.checked }))}
              disabled={isLoading}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="sendConfirmation" className="text-sm font-normal text-muted-foreground cursor-pointer">
              Enviar confirmação por WhatsApp
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isLoading}
            className="rounded-[4px]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !formData.lead_id || !formData.date || !formData.start_time || !formData.end_time}
            className="bg-primary hover:bg-primary-hover text-primary-foreground rounded-[4px]"
          >
            {isLoading ? "Scheduling..." : "Schedule Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaReuniaoModal;
