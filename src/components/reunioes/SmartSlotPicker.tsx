import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Loader2, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useConsultorDisponibilidade } from '@/hooks/useConsultorDisponibilidade';

const DURATION_OPTIONS = [
  { value: 30, label: '30min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
];

const PERIOD_LABELS: Record<string, string> = {
  manha: 'Manh\u00e3',
  tarde: 'Tarde',
  noite: 'Noite',
};

interface SmartSlotPickerProps {
  consultorId: string;
  initialDate?: string;
  initialStartTime?: string;
  initialDuration?: number;
  onSelect: (date: string, startTime: string, endTime: string) => void;
  onDurationChange?: (duration: number) => void;
  className?: string;
}

export const SmartSlotPicker = ({
  consultorId,
  initialDate,
  initialStartTime,
  initialDuration = 60,
  onSelect,
  onDurationChange,
  className,
}: SmartSlotPickerProps) => {
  const [duration, setDuration] = useState(initialDuration);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate + 'T12:00:00') : undefined,
  );
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualStart, setManualStart] = useState(initialStartTime || '');
  const [manualEnd, setManualEnd] = useState('');

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  const { data: timeSlots = [], isLoading } = useConsultorDisponibilidade({
    consultorId,
    date: dateStr,
    duration,
  });

  // Reset selected slot when date or duration changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [dateStr, duration]);

  // Reset manual fields when switching away from manual
  useEffect(() => {
    if (!manualMode) {
      setManualStart(initialStartTime || '');
      setManualEnd('');
    }
  }, [manualMode, initialStartTime]);

  const availableSlots = timeSlots.filter((s) => s.available);

  const slotsByPeriod = {
    manha: availableSlots.filter((s) => {
      const h = parseInt(s.start.split(':')[0]);
      return h >= 6 && h < 12;
    }),
    tarde: availableSlots.filter((s) => {
      const h = parseInt(s.start.split(':')[0]);
      return h >= 12 && h < 18;
    }),
    noite: availableSlots.filter((s) => {
      const h = parseInt(s.start.split(':')[0]);
      return h >= 18 && h < 24;
    }),
  };

  const handleDurationChange = (val: number) => {
    setDuration(val);
    onDurationChange?.(val);
  };

  const handleSlotClick = (slot: { start: string; end: string }) => {
    setSelectedSlot(slot);
    onSelect(dateStr, slot.start.slice(0, 5), slot.end.slice(0, 5));
  };

  const handleManualApply = () => {
    if (dateStr && manualStart && manualEnd) {
      onSelect(dateStr, manualStart, manualEnd);
    }
  };

  const currentSlotNorm = initialStartTime ? initialStartTime.slice(0, 5) : null;

  // No consultant fallback
  if (!consultorId) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 p-3 rounded-[2px] bg-muted border border-border">
          <UserX className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Selecione um consultor para ver hor&aacute;rios dispon&iacute;veis
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Hor&aacute;rio manual</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="time"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="h-[30px] text-xs rounded-[4px]"
              placeholder="In&iacute;cio"
            />
            <Input
              type="time"
              value={manualEnd}
              onChange={(e) => setManualEnd(e.target.value)}
              className="h-[30px] text-xs rounded-[4px]"
              placeholder="Fim"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Duration pills */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Dura&ccedil;&atilde;o</p>
        <div className="flex gap-1.5 flex-wrap">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleDurationChange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-[4px] border font-medium transition-colors',
                duration === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-muted text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date picker */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Data</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-full justify-start text-left font-normal text-xs h-[30px] rounded-[4px]',
                !selectedDate && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {selectedDate
                ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })
                : 'Selecionar data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => setSelectedDate(date)}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Slot grid or manual */}
      {manualMode ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Hor&aacute;rio manual</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">In&iacute;cio</label>
              <Input
                type="time"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="h-[30px] text-xs rounded-[4px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Fim</label>
              <Input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="h-[30px] text-xs rounded-[4px]"
              />
            </div>
          </div>
          {dateStr && manualStart && manualEnd && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleManualApply}
              className="h-[30px] text-xs rounded-[4px]"
            >
              Aplicar hor&aacute;rio
            </Button>
          )}
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="text-[11px] text-primary hover:underline"
          >
            &larr; Voltar aos hor&aacute;rios dispon&iacute;veis
          </button>
        </div>
      ) : (
        <>
          {selectedDate && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Carregando hor&aacute;rios...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-6 bg-muted rounded-[2px] border border-border">
                  <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum hor&aacute;rio dispon&iacute;vel nesta data</p>
                </div>
              ) : (
                (['manha', 'tarde', 'noite'] as const).map((period) => {
                  const slots = slotsByPeriod[period];
                  if (!slots.length) return null;
                  return (
                    <div key={period}>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        {PERIOD_LABELS[period]}
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {slots.map((slot, i) => {
                          const slotTime = slot.start.slice(0, 5);
                          const isSelected = selectedSlot?.start === slot.start;
                          const isCurrent = currentSlotNorm === slotTime;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSlotClick(slot)}
                              className={cn(
                                'py-2 text-xs rounded-[4px] border font-medium text-center transition-colors',
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-card border-border hover:bg-muted text-foreground',
                                isCurrent && !isSelected && 'ring-2 ring-primary/30',
                              )}
                            >
                              {slotTime}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {!selectedDate && (
            <div className="text-center py-6 bg-muted rounded-[2px] border border-border border-dashed">
              <CalendarIcon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Selecione uma data para ver os hor&aacute;rios</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="text-[11px] text-primary hover:underline"
          >
            Definir hor&aacute;rio manualmente &rarr;
          </button>
        </>
      )}
    </div>
  );
};
