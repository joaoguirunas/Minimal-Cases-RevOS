import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StepHistoryEntry {
  id: string;
  step_id: string;
  lead_id?: string;
  executed_at: string;
  success: boolean;
  result?: any;
  error_message?: string;
}

export const useAgentStepHistory = (stepId: string) => {
  return useQuery({
    queryKey: ['ai-agent-step-history', stepId],
    queryFn: async () => {
      if (!stepId) return [];

      const { data, error } = await supabase
        .from('ai_agents_steps_history')
        .select('*')
        .eq('step_id', stepId)
        .order('executed_at', { ascending: false });

      if (error) throw error;

      return (data || []) as StepHistoryEntry[];
    },
    enabled: !!stepId
  });
};
