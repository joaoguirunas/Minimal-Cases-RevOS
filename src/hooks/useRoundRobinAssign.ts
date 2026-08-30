import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useRoundRobinAssign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, teamId }: { leadId: string; teamId: string }): Promise<string | null> => {
      const { data, error } = await supabase.rpc('assign_lead_round_robin', {
        p_lead_id: leadId,
        p_team_id: teamId,
      });

      if (error) throw new Error(error.message);
      return data as string | null;
    },
    onSuccess: (userId, { leadId }) => {
      if (userId) {
        toast.success('Lead atribuído automaticamente via rodízio.');
      } else {
        toast.warning('Nenhum membro ativo no time para atribuição.');
      }
      queryClient.invalidateQueries({ queryKey: ['negocio', leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atribuir lead: ' + error.message);
    },
  });
};
