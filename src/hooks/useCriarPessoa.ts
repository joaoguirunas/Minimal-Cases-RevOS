import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { auditLogger } from '@/utils/auditLogger';

export interface CriarPessoaData {
  nome: string;
  email?: string;
  whatsapp?: string;
  documento?: string;
  status?: string;
  observacoes?: string;
  aceita_ligacao?: boolean;
  tipo?: string;
  pipeline_id?: string;
  team_id?: string;
  company_id?: string;
}

interface CreatePessoaWithLeadResult {
  pessoa_id: string;
  lead_id: string;
  success: boolean;
}

export const useCriarPessoa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dadosPessoa: CriarPessoaData) => {
      console.log('🚀 Criando pessoa com dados:', dadosPessoa);
      
      const { pipeline_id, ...pessoaDataRaw } = dadosPessoa;

      // 1. Se pipeline selecionado, buscar o primeiro stage
      let firstStageId: string | null = null;
      if (pipeline_id) {
        const { data: stages, error: stagesError } = await supabase
          .from('leads_stages')
          .select('id')
          .eq('leads_pipelines_id', pipeline_id)
          .eq('active', true)
          .order('order_index', { ascending: true })
          .limit(1);

        if (stagesError) throw new Error('Erro ao buscar etapas do pipeline');
        if (!stages || stages.length === 0) throw new Error('Pipeline não possui etapas ativas');
        firstStageId = stages[0].id;
      }

      // 2. Criar a pessoa
      const pessoaData = {
        name: pessoaDataRaw.nome?.trim(),
        email: pessoaDataRaw.email?.trim() || null,
        whatsapp: pessoaDataRaw.whatsapp?.trim() || null,
        status: pessoaDataRaw.status || 'active',
        accepts_calls: pessoaDataRaw.aceita_ligacao !== undefined ? pessoaDataRaw.aceita_ligacao : true,
        ai_enabled: true,
        notes: pessoaDataRaw.observacoes?.trim() || null,
        document: pessoaDataRaw.documento?.trim() || null,
        type: pessoaDataRaw.tipo || null,
      };

      const { data: pessoaCriada, error: pessoaError } = await supabase
        .from('clients_people')
        .insert(pessoaData)
        .select()
        .single();

      if (pessoaError) throw pessoaError;

      // 3. Se pipeline fornecido, criar lead vinculado
      let leadCriado = null;
      if (pipeline_id && firstStageId) {
        const leadData = {
          people_id: pessoaCriada.id,
          leads_pipelines_id: pipeline_id,
          leads_stages_id: firstStageId,
          status: 'in_progress',
          value: 0,
          title: `Lead - ${pessoaCriada.name}`,
          teams_id: dadosPessoa.team_id || null,
          company_id: dadosPessoa.company_id || null,
        };

        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .insert(leadData)
          .select()
          .single();

        if (leadError) {
          await supabase.from('clients_people').delete().eq('id', pessoaCriada.id);
          throw leadError;
        }
        leadCriado = lead;
      }

      // Audit log
      await auditLogger.log({
        action: 'person_created',
        resource_type: 'person',
        resource_id: pessoaCriada.id,
        details: {
          name: pessoaCriada.name,
          whatsapp: pessoaCriada.whatsapp,
          email: pessoaCriada.email,
          pipeline_id: pipeline_id || null,
          lead_id: leadCriado?.id || null,
        },
      });

      return { pessoa: pessoaCriada, lead: leadCriado };
    },
    onSuccess: () => {
      console.log('🔄 Sucesso - invalidando queries...');
      // Webhook de novo_lead é disparado automaticamente via trigger no banco
      
      queryClient.invalidateQueries({ queryKey: ['pessoas'] });
      queryClient.invalidateQueries({ queryKey: ['pessoas-paginadas'] });
      queryClient.invalidateQueries({ queryKey: ['conversas'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      
      toast.success('Pessoa e negócio criados com sucesso!');
    },
    onError: (error: any) => {
      console.error('💥 Erro na mutação:', error);
      
      // Tratamento específico de erros
      if (error.message?.includes('WhatsApp já está cadastrado')) {
        toast.error('Este número de WhatsApp já está cadastrado no sistema');
      } else if (error.message?.includes('Pipeline não possui etapas')) {
        toast.error('Pipeline selecionado não possui etapas ativas');
      } else if (error.message?.includes('Parâmetros obrigatórios')) {
        toast.error('Dados obrigatórios não fornecidos');
      } else {
        toast.error(error.message || 'Erro ao criar pessoa e negócio');
      }
    },
  });
};
