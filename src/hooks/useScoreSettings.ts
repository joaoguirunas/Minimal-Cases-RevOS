import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScoreSettings {
  objectivesLabel: string;
  investmentsLabel: string;
  framingsLabel: string;
}

const DEFAULTS: ScoreSettings = {
  objectivesLabel: 'Objetivos',
  investmentsLabel: 'Faixas de Investimento',
  framingsLabel: 'Segmentos',
};

export function useScoreSettings() {
  return useQuery({
    queryKey: ['score_settings'],
    queryFn: async (): Promise<ScoreSettings> => {
      const { data, error } = await supabase
        .from('score_settings')
        .select('key, value');
      if (error) throw error;
      const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
      return {
        objectivesLabel: map['objectives_label'] ?? DEFAULTS.objectivesLabel,
        investmentsLabel: map['investments_label'] ?? DEFAULTS.investmentsLabel,
        framingsLabel: map['framings_label'] ?? DEFAULTS.framingsLabel,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useUpdateScoreSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<ScoreSettings>) => {
      const rows: { key: string; value: string }[] = [];
      if (settings.objectivesLabel !== undefined)
        rows.push({ key: 'objectives_label', value: settings.objectivesLabel });
      if (settings.investmentsLabel !== undefined)
        rows.push({ key: 'investments_label', value: settings.investmentsLabel });
      if (settings.framingsLabel !== undefined)
        rows.push({ key: 'framings_label', value: settings.framingsLabel });

      for (const row of rows) {
        const { error } = await supabase
          .from('score_settings')
          .upsert(row, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score_settings'] });
    },
  });
}
