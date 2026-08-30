import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchedules } from './useSchedules';

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface UseConsultorDisponibilidadeParams {
  consultorId: string;
  date: string;
  duration: number; // em minutos
}

export const useConsultorDisponibilidade = ({ 
  consultorId, 
  date, 
  duration 
}: UseConsultorDisponibilidadeParams) => {
  const { data: schedules = [], isLoading: isLoadingSchedules } = useSchedules(consultorId);

  console.log('🔍 useConsultorDisponibilidade - Params:', {
    consultorId,
    date,
    duration,
    schedulesCount: schedules.length,
    isLoadingSchedules,
    schedules
  });

  return useQuery({
    queryKey: ['consultor-disponibilidade', consultorId, date, duration],
    queryFn: async () => {
      console.log('🔍 useConsultorDisponibilidade - Starting query with schedules:', schedules);

      // Pegar dia da semana (0 = domingo, 6 = sábado)
      const selectedDate = new Date(date + 'T12:00:00');
      const dayOfWeek = selectedDate.getDay();

      console.log('🔍 useConsultorDisponibilidade - Day of week:', dayOfWeek, 'Date:', date);

      // Filtrar horários de trabalho do dia
      const workSchedules = schedules.filter(s => s.day_of_week === dayOfWeek);

      console.log('🔍 useConsultorDisponibilidade - Work schedules for this day:', workSchedules);

      if (workSchedules.length === 0) {
        console.log('⚠️ useConsultorDisponibilidade - No work schedules found for day', dayOfWeek);
        return [];
      }

      // Query range em UTC para corresponder ao armazenamento TIMESTAMPTZ
      const startOfDay = new Date(`${date}T00:00:00`).toISOString();
      const endOfDay   = new Date(`${date}T23:59:59`).toISOString();

      const { data: existingMeetings, error } = await supabase
        .from('meetings')
        .select('start_time, end_time')
        .eq('user_id', consultorId)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .in('status', ['agendado', 'compareceu']);

      if (error) {
        console.error('❌ useConsultorDisponibilidade - Error fetching existing meetings:', error);
        throw error;
      }

      console.log('🔍 useConsultorDisponibilidade - Existing meetings:', existingMeetings);

      // Gerar todos os slots possíveis
      const allSlots: TimeSlot[] = [];

      workSchedules.forEach(schedule => {
        const startTime = schedule.start_time;
        const endTime = schedule.end_time;

        console.log('🔍 Processing schedule:', {
          day: schedule.day_of_week,
          start: startTime,
          end: endTime
        });

        // Converter horários para minutos
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        // Validar horários válidos (0-23 horas)
        if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
          console.error('❌ Invalid time format:', { startTime, endTime });
          return;
        }

        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        // Detectar se o horário cruza meia-noite
        const crossesMidnight = endMinutes < currentMinutes;
        const adjustedEndMinutes = crossesMidnight ? endMinutes + (24 * 60) : endMinutes;

        console.log('🔍 Schedule time info:', {
          currentMinutes,
          endMinutes,
          crossesMidnight,
          adjustedEndMinutes
        });

        // Validar que a duração não excede o intervalo total disponível em 24h
        if (duration > (24 * 60)) {
          console.warn('⚠️ Duration exceeds 24 hours');
          return;
        }

        // Gerar slots de acordo com a duração
        while (currentMinutes + duration <= adjustedEndMinutes) {
          const slotStartHour = Math.floor(currentMinutes / 60) % 24; // Usar módulo 24 para horas
          const slotStartMin = currentMinutes % 60;
          const slotEndMinutes = currentMinutes + duration;
          const slotEndHour = Math.floor(slotEndMinutes / 60) % 24;
          const slotEndMin = slotEndMinutes % 60;

          const slotStart = `${String(slotStartHour).padStart(2, '0')}:${String(slotStartMin).padStart(2, '0')}:00`;
          const slotEnd = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}:00`;

          // Verificar se está ocupado — converte UTC → horário local para comparar com slots locais
          const toLocalHHMMSS = (iso: string): string => {
            const d = new Date(iso);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
          };
          const isOccupied = existingMeetings?.some(meeting => {
            const meetingStart = toLocalHHMMSS(meeting.start_time);
            const meetingEnd   = toLocalHHMMSS(meeting.end_time);

            return (
              (slotStart >= meetingStart && slotStart < meetingEnd) ||
              (slotEnd > meetingStart && slotEnd <= meetingEnd) ||
              (slotStart <= meetingStart && slotEnd >= meetingEnd)
            );
          }) || false;

          allSlots.push({
            start: slotStart,
            end: slotEnd,
            available: !isOccupied
          });

          currentMinutes += 30; // Incrementar de 30 em 30 minutos
        }
      });

      // Ordenar slots por horário antes de retornar
      const sortedSlots = allSlots.sort((a, b) => {
        return a.start.localeCompare(b.start);
      });

      console.log('🔍 useConsultorDisponibilidade - Generated slots:', {
        total: sortedSlots.length,
        available: sortedSlots.filter(s => s.available).length,
        occupied: sortedSlots.filter(s => !s.available).length,
        firstSlot: sortedSlots[0],
        lastSlot: sortedSlots[sortedSlots.length - 1]
      });

      // === Subtract Google Calendar busy times ===
      try {
        const { data: gcData, error: gcError } = await supabase.functions.invoke('google-cal-availability', {
          body: { user_id: consultorId, date },
        });
        if (!gcError && gcData?.busy?.length > 0) {
          const googleBusy: Array<{ start: string; end: string }> = gcData.busy;
          sortedSlots.forEach((slot) => {
            if (!slot.available) return;
            const blocked = googleBusy.some((busy) => {
              return (
                (slot.start >= busy.start && slot.start < busy.end) ||
                (slot.end > busy.start && slot.end <= busy.end) ||
                (slot.start <= busy.start && slot.end >= busy.end)
              );
            });
            if (blocked) slot.available = false;
          });
        }
      } catch (gcErr) {
        console.warn('Google Calendar availability check failed (graceful fallback):', gcErr);
      }

      return sortedSlots;
    },
    enabled: !!consultorId && !!date && duration > 0 && !isLoadingSchedules
  });
};
