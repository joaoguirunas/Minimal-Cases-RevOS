import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AiAgent {
  id: string;
  name: string;
  elevenlabs_agent_id: string | null;
}

export const useAiAgents = () => {
  return useQuery({
    queryKey: ['ai-agents', 'voice'],
    queryFn: async (): Promise<AiAgent[]> => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, elevenlabs_agent_id')
        .eq('agent_type', 'voice')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as AiAgent[];
    },
  });
};
