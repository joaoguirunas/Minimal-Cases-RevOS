import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContactStatus } from '@/types/sends';

interface UpdateContactStatusParams {
  id: string;
  status: ContactStatus;
  sendId: string;
}

export const useUpdateContactStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: UpdateContactStatusParams) => {
      // sends_contacts not in auto-generated Supabase types — cast required
      const { data, error } = await (supabase as any)
        .from('sends_contacts')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Status atualizado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['send-contacts', variables.sendId] });
      queryClient.invalidateQueries({ queryKey: ['send', variables.sendId] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
};
