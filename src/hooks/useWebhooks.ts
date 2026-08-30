import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Webhook, WebhookLog, WebhookEventType } from '@/types/sends';
import { toast } from 'sonner';

// Hook para buscar todos os webhooks
export const useWebhooks = (eventType?: WebhookEventType) => {
  return useQuery({
    queryKey: ['webhooks', eventType],
    queryFn: async () => {
      let query = supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (eventType) {
        query = query.eq('event_type', eventType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Webhook[];
    },
  });
};

// Hook para buscar logs de um webhook específico
export const useWebhookLogs = (webhookId?: string, limit: number = 20) => {
  return useQuery({
    queryKey: ['webhook-logs', webhookId, limit],
    queryFn: async () => {
      if (!webhookId) return [];
      
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as WebhookLog[];
    },
    enabled: !!webhookId,
  });
};

// Hook para criar webhook
export const useCreateWebhook = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (webhook: Omit<Webhook, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('webhooks')
        .insert([webhook])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar webhook: ${error.message}`);
    },
  });
};

// Hook para atualizar webhook
export const useUpdateWebhook = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Webhook> & { id: string }) => {
      const { data, error } = await supabase
        .from('webhooks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar webhook: ${error.message}`);
    },
  });
};

// Hook para deletar webhook
export const useDeleteWebhook = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir webhook: ${error.message}`);
    },
  });
};

// Hook para disparar webhooks (chamada à edge function)
export const useDispararWebhook = () => {
  return useMutation({
    mutationFn: async ({ tipo, lead_id }: { tipo: WebhookEventType; lead_id: string }) => {
      const { data, error } = await supabase.functions.invoke('dispara-webhook', {
        body: { tipo, lead_id },
      });
      
      if (error) throw error;
      return data;
    },
    onError: (error: Error) => {
      console.error('Erro ao disparar webhook:', error);
    },
  });
};

// Hook para estatísticas de um webhook
export const useWebhookStats = (webhookId?: string) => {
  return useQuery({
    queryKey: ['webhook-stats', webhookId],
    queryFn: async () => {
      if (!webhookId) return null;
      
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('status_code')
        .eq('webhook_id', webhookId);
      
      if (error) throw error;
      
      const total = data.length;
      const success = data.filter(log => log.status_code >= 200 && log.status_code < 300).length;
      const failed = total - success;
      
      return { total, success, failed };
    },
    enabled: !!webhookId,
  });
};
