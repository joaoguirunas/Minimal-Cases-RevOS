import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SendWebhook } from '@/types/sends';
import { toast } from 'sonner';

export const useSendWebhooks = () => {
  return useQuery({
    queryKey: ['send-webhooks'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sends_webhooks')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as SendWebhook[];
    },
  });
};

export const useCreateWebhook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhook: Omit<SendWebhook, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await (supabase as any)
        .from('sends_webhooks')
        .insert([webhook])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['send-webhooks'] });
      toast.success('Webhook criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar webhook: ${error.message}`);
    },
  });
};

export const useUpdateWebhook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SendWebhook> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('sends_webhooks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['send-webhooks'] });
      toast.success('Webhook atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar webhook: ${error.message}`);
    },
  });
};

export const useDeleteWebhook = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('sends_webhooks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['send-webhooks'] });
      toast.success('Webhook excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir webhook: ${error.message}`);
    },
  });
};
