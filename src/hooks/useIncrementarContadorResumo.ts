import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface IncrementarContadorParams {
  pessoaId: string;
  tenantId?: string; // kept for backward compat, not used
}

export const useIncrementarContadorResumo = () => {
  return useMutation({
    mutationFn: async ({ pessoaId, tenantId }: IncrementarContadorParams) => {
      console.log('Incrementando contador de mensagens para resumo:', pessoaId);
      
      // Primeiro, buscar o valor atual do contador
      const { data: pessoa, error: fetchError } = await supabase
        .from('clients_people')
        .select('summary_message_counter')
        .eq('id', pessoaId)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar contador atual:', fetchError);
        throw fetchError;
      }

      const contadorAtual = pessoa?.summary_message_counter || 0;
      const novoContador = contadorAtual + 1;

      // Incrementar o contador de mensagens para resumo
      const { error } = await supabase
        .from('clients_people')
        .update({ 
          summary_message_counter: novoContador,
          updated_at: new Date().toISOString()
        })
        .eq('id', pessoaId);

      if (error) {
        console.error('Erro ao incrementar contador de resumo:', error);
        throw error;
      }

      console.log(`Contador de mensagens incrementado: ${contadorAtual} -> ${novoContador}`);
      return novoContador;
    },
    onError: (error) => {
      console.error('Erro ao incrementar contador de resumo:', error);
    },
  });
};
