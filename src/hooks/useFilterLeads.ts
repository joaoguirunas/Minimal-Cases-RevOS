import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SendFilters, FilterResult } from '@/types/sends';

export const useFilterLeads = () => {
  return useMutation({
    mutationFn: async (filters: SendFilters) => {
      console.log('🔍 Iniciando filtro com:', filters);
      
      const { data, error } = await supabase.functions.invoke('filter-leads-for-send', {
        body: { filters }
      });
      
      if (error) {
        console.error('❌ Erro na edge function:', error);
        throw error;
      }
      
      // Validar estrutura da resposta
      if (!data || typeof data !== 'object') {
        console.error('❌ Resposta inválida da edge function:', data);
        throw new Error('Resposta inválida do servidor');
      }
      
      const result = data as FilterResult;
      
      // Validar campos obrigatórios
      if (typeof result.total !== 'number' || !Array.isArray(result.contacts)) {
        console.error('❌ Estrutura de dados inválida:', result);
        throw new Error('Estrutura de dados inválida');
      }
      
      console.log('✅ Filtro concluído:', {
        total: result.total,
        contactsLength: result.contacts.length,
        firstContact: result.contacts[0]
      });
      
      return result;
    },
    onError: (error: Error) => {
      console.error('❌ Erro no filtro de leads:', error);
      toast.error(`Erro ao filtrar: ${error.message}`);
    },
  });
};
