import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useArquivarPessoa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pessoaId: string) => {
      console.log('🗄️ Arquivando pessoa:', pessoaId);
      
      const { data, error } = await supabase
        .from('clients_people')
        .update({ status: 'archived' })
        .eq('id', pessoaId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao arquivar pessoa:', error);
        throw error;
      }

      console.log('✅ Pessoa arquivada:', data);
      return data;
    },
    onSuccess: () => {
      console.log('🔄 Sucesso - invalidando queries...');
      
      queryClient.invalidateQueries({ queryKey: ['pessoas'] });
      queryClient.invalidateQueries({ queryKey: ['conversas'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      
      toast.success('Pessoa arquivada com sucesso!');
    },
    onError: (error: any) => {
      console.error('💥 Erro ao arquivar pessoa:', error);
      toast.error(error.message || 'Erro ao arquivar pessoa');
    },
  });
};
