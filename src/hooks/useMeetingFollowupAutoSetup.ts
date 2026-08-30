import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AutoSetupResult {
  templates_created: number;
  templates_reused: number;
  templates_failed: number;
  rules_created: number;
  rules_existing: number;
  message: string;
}

export const useMeetingFollowupAutoSetup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string): Promise<AutoSetupResult> => {
      const { data, error } = await supabase.functions.invoke('meeting-followup-auto-setup', {
        body: { channel_id: channelId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as AutoSetupResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-followups'] });
      toast.success(
        `Auto-setup completo: ${data.templates_created} templates criados, ${data.rules_created} regras criadas`,
      );
    },
    onError: (err: Error) => {
      toast.error(`Erro no auto-setup: ${err.message}`);
    },
  });
};
