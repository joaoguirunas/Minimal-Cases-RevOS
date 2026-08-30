import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AtualizarPessoaData {
  id: string;
  nome: string;
  email?: string;
  whatsapp?: string;
  telefone?: string;
  documento?: string;
  instagram_handle?: string;
  status?: string;
  service_status?: string;
  observacoes?: string;
  aceita_ligacao?: boolean;
  ai_enabled?: boolean;
  tipo?: string;
  source?: string;
  income?: string;
  moment?: string;
  goal?: string;
  disc_profile?: string;
  disc_summary?: string;
  team_id?: string;
  score_objective_id?: string;
  score_investment_id?: string;
  score_framing_id?: string;
}

export interface AtualizarPessoaResult {
  pessoa: any;
  mergedIntoId?: string;  // set when auto-merge happened — caller should redirect
  mergedIntoName?: string;
}

export const useAtualizarPessoaComplete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dadosPessoa: AtualizarPessoaData): Promise<AtualizarPessoaResult> => {
      console.log('🚀 Atualizando pessoa:', dadosPessoa.id);

      const { id, team_id, score_objective_id: _so, score_investment_id: _si, score_framing_id: _sf, ...pessoaDataRaw } = dadosPessoa;

      // 1. Atualizar dados da pessoa
      // Os campos individuais de score disparam o trigger que auto-vincula a matriz
      // Os campos de identidade (email, whatsapp, etc.) disparam o trigger de auto-merge
      const pessoaData = {
        name: pessoaDataRaw.nome?.trim(),
        email: pessoaDataRaw.email?.trim() || null,
        whatsapp: pessoaDataRaw.whatsapp?.trim() || null,
        telefone: pessoaDataRaw.telefone?.trim() || null,
        instagram_handle: pessoaDataRaw.instagram_handle?.trim().replace(/^@/, '') || null,
        status: pessoaDataRaw.status || 'active',
        service_status: pessoaDataRaw.service_status || null,
        accepts_calls: pessoaDataRaw.aceita_ligacao !== undefined ? pessoaDataRaw.aceita_ligacao : true,
        ai_enabled: pessoaDataRaw.ai_enabled !== undefined ? pessoaDataRaw.ai_enabled : true,
        notes: pessoaDataRaw.observacoes?.trim() || null,
        document: pessoaDataRaw.documento?.trim() || null,
        type: pessoaDataRaw.tipo || null,
        source: pessoaDataRaw.source?.trim() || null,
        income: pessoaDataRaw.income?.trim() || null,
        moment: pessoaDataRaw.moment?.trim() || null,
        goal: pessoaDataRaw.goal?.trim() || null,
        disc_profile: pessoaDataRaw.disc_profile?.trim() || null,
        disc_summary: pessoaDataRaw.disc_summary?.trim() || null,
      };

      console.log('🧹 Atualizando pessoa com dados:', pessoaData);

      const { data: pessoaAtualizada, error: pessoaError } = await supabase
        .from('clients_people')
        .update(pessoaData)
        .eq('id', id)
        .select()
        .single();

      if (pessoaError) {
        console.error('❌ Erro ao atualizar pessoa:', pessoaError);
        throw pessoaError;
      }

      console.log('✅ Pessoa atualizada:', pessoaAtualizada);

      // 2. Check if the DB trigger auto-merged this person into another canonical record
      // The trigger runs AFTER the update — re-fetch to detect merged_into_id
      const { data: pessoaPos } = await supabase
        .from('clients_people')
        .select('id, status, merged_into_id')
        .eq('id', id)
        .single();

      if (pessoaPos?.status === 'merged' && pessoaPos.merged_into_id) {
        const { data: canonical } = await supabase
          .from('clients_people')
          .select('id, name')
          .eq('id', pessoaPos.merged_into_id)
          .single();
        return {
          pessoa: pessoaAtualizada,
          mergedIntoId: pessoaPos.merged_into_id,
          mergedIntoName: canonical?.name,
        };
      }

      // 2. Atualizar time do lead (se fornecido)
      if (team_id !== undefined) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({ teams_id: team_id || null })
          .eq('people_id', id);

        if (leadError) {
          console.error('⚠️ Erro ao atualizar time do lead:', leadError);
        } else {
          console.log('✅ Time do lead atualizado');
        }
      }

      console.log('🎉 Atualização finalizada com sucesso');
      return { pessoa: pessoaAtualizada };
    },
    onSuccess: (result: AtualizarPessoaResult) => {
      console.log('🔄 Sucesso - invalidando queries...');

      queryClient.invalidateQueries({ queryKey: ['pessoas'] });
      queryClient.invalidateQueries({ queryKey: ['pessoas-paginadas'] });
      queryClient.invalidateQueries({ queryKey: ['conversas'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['pessoa'] });

      if (result.mergedIntoId) {
        toast.success(
          `Contato unificado automaticamente com "${result.mergedIntoName || 'outro contato'}" pois compartilham a mesma informação de identidade.`,
          { duration: 6000 }
        );
      } else {
        toast.success('Pessoa atualizada com sucesso!');
      }
    },
    onError: (error: any) => {
      console.error('💥 Erro na mutação:', error);
      toast.error(error.message || 'Erro ao atualizar pessoa');
    },
  });
};
