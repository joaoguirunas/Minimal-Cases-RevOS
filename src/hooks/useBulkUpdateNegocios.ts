import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkUpdateParams {
  ids: string[];
  updates: {
    leads_stages_id?: string | null;
    status?: string | null;
    user_id?: string | null;
    teams_id?: string | null;
  };
}

export const useBulkUpdateNegocios = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: BulkUpdateParams) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from('leads')
        .update(updates)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
      queryClient.invalidateQueries({ queryKey: ['negocio'] });
      toast.success('Negócios atualizados com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar negócios: ${error.message}`);
      console.error('[useBulkUpdateNegocios]', error);
    },
  });
};
