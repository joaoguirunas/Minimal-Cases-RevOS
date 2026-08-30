import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateNegocioStageParams {
  negocioId: string;
  stageId: string;
}

export const useUpdateNegocioStage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ negocioId, stageId }: UpdateNegocioStageParams) => {
      console.log('=== ATUALIZANDO ETAPA DO NEGÓCIO ===');
      console.log('Negócio ID:', negocioId);
      console.log('Nova etapa ID:', stageId);
      
      const { data, error } = await supabase
        .from('leads')
        .update({ leads_stages_id: stageId })
        .eq('id', negocioId)
        .select()
        .single();

      if (error) {
        console.error('=== ERRO NA ATUALIZAÇÃO DA ETAPA ===');
        console.error('Erro:', error);
        throw error;
      }
      
      console.log('=== ETAPA ATUALIZADA COM SUCESSO ===');
      console.log('Resultado:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('=== SINCRONIZAÇÃO APÓS MUDANÇA DE ETAPA ===');

      // Invalidar a query key correta do pipeline
      queryClient.invalidateQueries({
        queryKey: ['negocios-pipeline'],
        exact: false
      });

      // Invalidar o negócio específico (se usado em tela de detalhes)
      queryClient.invalidateQueries({
        queryKey: ['negocio', variables.negocioId],
        exact: true
      });

      // Invalidar conversas para atualizar o sidebar
      queryClient.invalidateQueries({
        queryKey: ['pessoas-conversas'],
        exact: false
      });

      // Invalidar a query usada na página de Conversas
      queryClient.invalidateQueries({
        queryKey: ['conversas-simples-v4'],
        exact: false
      });

      // Invalidar query de negocios geral
      queryClient.invalidateQueries({
        queryKey: ['negocios'],
        exact: false
      });

      // O enfileiramento de follow-ups da nova etapa já é feito pelo trigger
      // notify_lead_stage_changed no banco (dispara sozinho em QUALQUER UPDATE
      // de leads_stages_id, não só por aqui) — não duplicar a chamada aqui.

      console.log('=== SINCRONIZAÇÃO CONCLUÍDA ===');
      toast.success('Etapa atualizada com sucesso');
    },
    onError: (error: any) => {
      console.error('=== ERRO NO MUTATION ===');
      console.error('Erro completo:', error);
      toast.error(error.message || 'Erro ao atualizar etapa');
    }
  });
};
