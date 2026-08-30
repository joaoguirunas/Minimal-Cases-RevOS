import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { auditLogger } from '@/utils/auditLogger';

export interface Schedule {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
}

export const useSchedules = (userId?: string) => {
  const query = useQuery({
    queryKey: ['schedules', userId],
    queryFn: async () => {
      console.log('🔍 useSchedules - Fetching schedules for userId:', userId);
      
      let query = supabase
        .from('settings_schedules')
        .select('*')
        .eq('is_available', true);
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.order('day_of_week').order('start_time');
      
      if (error) {
        console.error('❌ useSchedules - Error fetching schedules:', error);
        throw error;
      }
      
      console.log('✅ useSchedules - Schedules fetched:', {
        userId,
        count: data?.length || 0,
        schedules: data
      });
      
      return (data || []) as Schedule[];
    },
  });

  return query;
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (schedule: Omit<Schedule, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('settings_schedules')
        .insert([schedule])
        .select()
        .single();
      
      if (error) throw error;
      
      // Audit log
      await auditLogger.log({
        action: 'schedule_created',
        resource_type: 'schedule',
        resource_id: data.id,
        details: {
          usuario_id: schedule.usuario_id,
          dia_semana: schedule.dia_semana,
          hora_inicio: schedule.hora_inicio,
          hora_fim: schedule.hora_fim
        }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Horário criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar horário: ' + error.message);
    },
  });
};

export const useUpdateSchedule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Schedule> & { id: string }) => {
      const { data, error } = await supabase
        .from('settings_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Audit log
      await auditLogger.log({
        action: 'schedule_updated',
        resource_type: 'schedule',
        resource_id: id,
        details: {
          fields_changed: Object.keys(updates),
          updates: updates
        }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Horário atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar horário: ' + error.message);
    },
  });
};

export const useDeleteSchedule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Get schedule data before deleting
      const { data: scheduleToDelete } = await supabase
        .from('settings_schedules')
        .select('*')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('settings_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Audit log
      await auditLogger.log({
        action: 'schedule_deleted',
        resource_type: 'schedule',
        resource_id: id,
        details: {
          usuario_id: scheduleToDelete?.usuario_id,
          dia_semana: scheduleToDelete?.dia_semana
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Horário deletado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao deletar horário: ' + error.message);
    },
  });
};

// Backward compatibility
export const getDiaSemanaLabel = (dia: number) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dia];
export const useHorarios = useSchedules;
export const useCriarHorario = useCreateSchedule;
export const useUpdateHorario = useUpdateSchedule;
export const useDeleteHorario = useDeleteSchedule;
