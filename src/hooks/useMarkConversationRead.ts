import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveCanonicalPersonId } from '@/lib/personMerge';

/**
 * Clears the unread counter for a conversation via `mark_conversation_read`.
 * The RPC is idempotent and raises when the caller has no access to the person.
 */
export const useMarkConversationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pessoaId: string) => {
      // Unread lives on the surviving person — a merged id would mark nothing.
      const canonicalId = await resolveCanonicalPersonId(pessoaId);

      const { data, error } = await supabase.rpc('mark_conversation_read', {
        p_people_id: canonicalId,
      });
      if (error) throw error;
      return data ?? 0;
    },
    onSuccess: () => {
      // Invalida mesmo com 0 marcadas: a RPC atualiza first_unread_at, last_read_at
      // e as notificações do sino independente de ter marcado alguma mensagem.
      queryClient.invalidateQueries({ queryKey: ['conversas-simples-v5'] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
    },
    onError: (error) => {
      // Silent by design: failing to clear a badge must not interrupt reading the thread.
      console.error('❌ mark_conversation_read falhou', error);
    },
  });
};
