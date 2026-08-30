import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnqueueArgs {
  lead_id: string;
  stage_id: string;
}

/**
 * Chama a Edge Function followup-enqueue para criar jobs na followup_queue.
 * Deve ser chamado sempre que um lead mudar de etapa.
 */
export const useFollowupEnqueue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lead_id, stage_id }: EnqueueArgs) => {
      const { data, error } = await supabase.functions.invoke('followup-enqueue', {
        body: { lead_id, stage_id, source_type: 'stage' },
      });
      if (error) throw error;
      return data as { enqueued: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      queryClient.invalidateQueries({ queryKey: ['followup-queue-stats'] });
      if (data.enqueued > 0) {
        console.log(`[useFollowupEnqueue] ${data.enqueued} follow-up(s) agendado(s)`);
      }
    },
    onError: (error) => {
      console.error('[useFollowupEnqueue] Erro ao enfileirar follow-ups:', error);
      // Silencioso — não mostrar toast de erro para o usuário (operação de background)
    },
  });
};

/**
 * Trigger manual do worker (para testes / forçar processamento).
 * Normalmente chamado por pg_cron automaticamente.
 */
export const useFollowupTriggerWorker = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('followup-trigger-worker', {
        body: {},
      });
      if (error) throw error;
      return data as { processed: number; successful: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      queryClient.invalidateQueries({ queryKey: ['followup-queue-stats'] });
      toast.success(`Worker executado: ${data.successful}/${data.processed} disparados`);
    },
    onError: () => toast.error('Erro ao executar worker de follow-ups'),
  });
};
