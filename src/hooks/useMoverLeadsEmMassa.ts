import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MoverLeadsEmMassaParams {
  fromStageId: string;
  toStageId: string;
  quantidade: number;
}

interface MoverLeadsEmMassaResult {
  moved: number;
  available: number;
}

/** Move até `quantidade` leads (os mais antigos primeiro, só os em andamento) de
 * uma etapa pra outra, de uma vez. Cada lead movido passa pelo fluxo normal de
 * troca de etapa (o gatilho do banco cuida do follow-up individualmente, com
 * cooldown anti-duplicata). */
export const useMoverLeadsEmMassa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fromStageId, toStageId, quantidade }: MoverLeadsEmMassaParams): Promise<MoverLeadsEmMassaResult> => {
      const { data: candidatos, error: selectError } = await supabase
        .from('leads')
        .select('id')
        .eq('leads_stages_id', fromStageId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: true })
        .limit(quantidade);

      if (selectError) throw selectError;

      const ids = (candidatos ?? []).map((l) => l.id);
      if (ids.length === 0) return { moved: 0, available: 0 };

      const { error: updateError } = await supabase
        .from('leads')
        .update({ leads_stages_id: toStageId })
        .in('id', ids);

      if (updateError) throw updateError;

      return { moved: ids.length, available: ids.length };
    },
    onSuccess: ({ moved }) => {
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['negocios'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['conversas-simples-v5'], exact: false });
      if (moved > 0) {
        toast.success(`${moved} lead${moved === 1 ? '' : 's'} movido${moved === 1 ? '' : 's'}!`);
      } else {
        toast.info('Nenhum lead em andamento encontrado nessa etapa.');
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao mover leads: ' + error.message);
    },
  });
};
