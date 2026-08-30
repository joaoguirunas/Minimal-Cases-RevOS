import { useMutation, useQueryClient, type UseMutateFunction } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendDispatchResponse {
  success: boolean;
  message: string;
  processed?: number;
  failed?: number;
  total?: number;
  error?: string;
  validated?: boolean;
  has_more?: boolean;
  remaining?: number;
}

// Hook para validar webhook
export const useValidateWebhook = () => {
  return useMutation({
    mutationFn: async (sendId: string): Promise<SendDispatchResponse> => {
      const { data, error } = await supabase.functions.invoke('send-dispatch-worker', {
        body: {
          send_id: sendId,
          validate_only: true,
        },
      });

      if (error) throw new Error(error.message);
      return data as SendDispatchResponse;
    },
    onSuccess: (data) => {
      if (data.validated) {
        toast.success('Webhook validado com sucesso!');
      } else {
        toast.error(data.error || 'Webhook inválido');
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao validar webhook: ' + error.message);
    },
  });
};

interface DispatchResult {
  success: boolean;
  message: string;
  processed?: number;
  failed?: number;
}

type DispatchParams = { sendId: string; intervalSeconds?: number; batchSize?: number };

interface UseSendDispatchReturn {
  mutate: UseMutateFunction<DispatchResult, Error, DispatchParams>;
  isPending: boolean;
}

// Triggers the first batch immediately (for UI feedback) then hands off to pg_cron.
// The browser no longer owns the dispatch loop — pg_cron + sends-dispatch-batch
// continue processing even when the tab is closed.
export const useSendDispatch = (): UseSendDispatchReturn => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ sendId, batchSize = 1 }: DispatchParams): Promise<DispatchResult> => {
      const { data, error } = await supabase.functions.invoke('send-dispatch-worker', {
        body: { send_id: sendId, batch_size: batchSize },
      });

      if (error) {
        // Try to surface the actual server-side error message
        let actualMsg = error.message;
        try {
          const body = await (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
          if (body?.error) actualMsg = body.error;
        } catch { /* ignore parse errors, fall back to generic message */ }
        throw new Error(actualMsg);
      }

      const result = data as SendDispatchResponse;
      if (!result.success) throw new Error(result.error || 'Erro ao processar lote');

      queryClient.invalidateQueries({ queryKey: ['send', sendId] });
      queryClient.invalidateQueries({ queryKey: ['send-contacts', sendId] });

      return {
        success: true,
        message: result.has_more ? 'Primeiro lote enviado — disparo continua em background' : 'Disparo finalizado',
        processed: result.processed,
        failed: result.failed,
      };
    },
    onError: (error: Error) => {
      toast.error('Erro ao iniciar disparo: ' + error.message);
    },
  });

  return {
    mutate: mutation.mutate,
    isPending: mutation.isPending,
  };
};
