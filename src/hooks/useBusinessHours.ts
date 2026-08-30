import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BusinessHoursSettings {
  id?: string;
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  days_of_week: number[];
  timezone: string;
  bh_only_last: boolean;
}

export const DEFAULT_BH_SETTINGS: BusinessHoursSettings = {
  enabled:      false,
  start_hour:   8,
  end_hour:     18,
  days_of_week: [1, 2, 3, 4, 5],
  timezone:     'America/Sao_Paulo',
  bh_only_last: true,
};

const QUERY_KEY = ['settings-business-hours'];

export const useBusinessHoursSettings = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('settings_business_hours')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as BusinessHoursSettings | null) ?? { ...DEFAULT_BH_SETTINGS };
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateBusinessHoursSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: BusinessHoursSettings) => {
      const payload = {
        enabled:      settings.enabled,
        start_hour:   settings.start_hour,
        end_hour:     settings.end_hour,
        days_of_week: settings.days_of_week,
        timezone:     settings.timezone,
        bh_only_last: settings.bh_only_last,
        updated_at:   new Date().toISOString(),
      };

      if (settings.id) {
        const { error } = await (supabase as any)
          .from('settings_business_hours')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        // Upsert: find existing row first
        const { data: existing } = await (supabase as any)
          .from('settings_business_hours')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await (supabase as any)
            .from('settings_business_hours')
            .update(payload)
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from('settings_business_hours')
            .insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Horário comercial atualizado!');
    },
    onError: () => toast.error('Erro ao salvar horário comercial'),
  });
};
