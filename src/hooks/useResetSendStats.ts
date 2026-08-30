import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useResetSendStats() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sendId: string) => {
      // Reset send statistics and status back to draft
      const { error: sendError } = await (supabase as any)
        .from('sends')
        .update({
          sent_count: 0,
          failed_count: 0,
          status: 'draft',
          started_at: null,
          completed_at: null,
        })
        .eq('id', sendId);

      if (sendError) throw sendError;

      // Reset all contacts to pending
      const { error: contactsError } = await (supabase as any)
        .from('sends_contacts')
        .update({
          status: 'pending',
          sent_at: null,
          delivered_at: null,
          read_at: null,
          error_message: null,
        })
        .eq('send_id', sendId);

      if (contactsError) throw contactsError;

      return { sendId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['send', data.sendId] });
      queryClient.invalidateQueries({ queryKey: ['send-contacts', data.sendId] });
      queryClient.invalidateQueries({ queryKey: ['sends'] });
      toast.success('Estatísticas resetadas com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error resetting send stats:', error);
      toast.error('Erro ao resetar estatísticas. Tente novamente.');
    },
  });
}
