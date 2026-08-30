// Complete single-tenant version of useNegocios with all exports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { auditLogger } from '@/utils/auditLogger';

// kiwify_lead_products is not yet in the generated Supabase types; the detail
// query joins it through an untyped view of the client (see useNegocio).
const sbUntyped = supabase as unknown as SupabaseClient;

export interface Negocio {
  id: string;
  people_id: string;
  leads_pipelines_id: string;
  leads_stages_id: string;
  user_id?: string;
  teams_id?: string;
  company_id?: string;
  value?: number;
  status: string;
  title?: string;
  created_at: string;
  updated_at: string;
  loss_reason?: string;
  leads_loss_reasons_id?: string;
  control?: string;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  fb_lead_id?: string;
  // Backward compatibility
  person_id?: string;
  pipeline_id?: string;
  stage_id?: string;
  titulo?: string;
  valor?: number;
  responsavel?: string;
  time_responsavel?: string;
  motivo_perda?: string;
  motivo_perda_id?: string;
  controle?: string;
  tentativas_followup?: number;
  // Related objects for populated queries
  person?: any;
  pessoa?: { 
    id: string; 
    name: string;
    nome: string;
    email?: string; 
    whatsapp?: string; 
    ai_enabled?: boolean;
    atendimento_ia?: boolean;
    service_status?: string;
    status_atendimento?: string;
    document?: string;
    documento?: string;
    notes?: string;
    observacoes?: string;
    conversation_summary?: string;
    resumo_conversa?: string;
    score_matrix_id?: string;
    score_objective_id?: string;
    score_investment_id?: string;
    score_framing_id?: string;
    score?: number;
    // Qualificação IA - Diagnóstico (Q1-Q8)
    q1_main_bottleneck?: string | null;
    q2_lead_volume_month?: number | null;
    q3_team_size?: number | null;
    q4_crm_maturity?: string | null;
    q5_crm_name?: string | null;
    q6_trigger?: string | null;
    q7_problem_impact?: string | null;
    q8_engagement_level?: string | null;
    // Qualificação IA - Qualificação (Q9-Q20)
    q9_decision_authority?: string | null;
    q10_stakeholders?: string | null;
    q11_budget_approved?: string | null;
    q12_timeline?: string | null;
    q13_urgency_reason?: string | null;
    q14_data_ready?: string | null;
    q15_minimum_volume?: string | null;
    q16_expected_roi?: string | null;
    q17_objections?: string | null;
    q18_real_fit?: string | null;
    q19_qualification_status?: string | null;
    q20_rejection_reason?: string | null;
    // Qualificação IA - Análise (Q21-Q24)
    q21_interest_level?: number | null;
    q22_close_probability?: number | null;
    q23_behavioral_tags?: string | null;
    q24_last_update_by_agent?: string | null;
    // Qualificação IA - DISC (Q25)
    q25_disc_profile?: string | null;
  };
  empresa?: {
    id: string;
    trade_name: string;
    legal_name?: string;
  };
  pipeline?: {
    id: string; 
    name: string;
    nome?: string;
  };
  stage?: { 
    id: string; 
    name: string;
    nome?: string;
    color?: string;
    cor?: string;
    order_index?: number;
    ordem?: number;
  };
}

// Main negocios query
export const useNegocios = () => {
  return useQuery({
    queryKey: ['negocios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          person:clients_people!leads_people_id_fkey(*),
          pipeline:leads_pipelines!leads_leads_pipelines_id_fkey(*),
          stage:leads_stages!leads_leads_stages_id_fkey(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Negocio[];
    },
  });
};

// Definitive version
export const useNegociosDefinitive = () => {
  return useQuery({
    queryKey: ['negocios-definitive'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          person:clients_people!leads_people_id_fkey(*),
          pipeline:leads_pipelines!leads_leads_pipelines_id_fkey(*),
          stage:leads_stages!leads_leads_stages_id_fkey(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Negocio[];
    },
  });
};

// Single negocio
export const useNegocio = (negocioId: string) => {
  return useQuery({
    queryKey: ['negocio', negocioId],
    queryFn: async () => {
      console.log('🔍 useNegocio - Fetching negocio:', negocioId);
      
      if (!negocioId) {
        console.warn('⚠️ useNegocio - No negocioId provided');
        return null;
      }
      
      const { data, error } = await sbUntyped
        .from('leads')
        .select(`
          *,
          pessoa:clients_people!leads_people_id_fkey (*, cursos:kiwify_lead_products(product_id, product_name)),
          pipeline:leads_pipelines!leads_leads_pipelines_id_fkey (
            id,
            name
          ),
          stage:leads_stages!leads_leads_stages_id_fkey (
            id,
            name,
            color
          )
        `)
        .eq('id', negocioId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // Adicionar aliases de compatibilidade
      const mappedData: any = {
        ...data,
        titulo: data.title,
        valor: data.value,
        person_id: data.people_id,
        pipeline_id: data.leads_pipelines_id,
        stage_id: data.leads_stages_id,
        controle: data.control,
        motivo_perda: data.loss_reason,
        motivo_perda_id: data.leads_loss_reasons_id
      };
      
      if (mappedData.pessoa) {
        mappedData.pessoa = {
          ...mappedData.pessoa,
          nome: mappedData.pessoa.name,
          atendimento_ia: mappedData.pessoa.ai_enabled,
          status_atendimento: mappedData.pessoa.service_status,
          documento: mappedData.pessoa.document,
          observacoes: mappedData.pessoa.notes
        };
      }
      
      if (mappedData.pipeline) {
        mappedData.pipeline.nome = mappedData.pipeline.name;
      }
      
      if (mappedData.stage) {
        mappedData.stage.nome = mappedData.stage.name;
        mappedData.stage.cor = mappedData.stage.color;
        mappedData.stage.ordem = mappedData.stage.order_index;
      }
      
      return mappedData as Negocio;
    },
    enabled: !!negocioId,
    retry: 1,
    staleTime: 0,
    refetchInterval: (query) => query.state.data ? 120_000 : false,
    refetchIntervalInBackground: false
  });
};

// MULTI-PIPELINE-01: um people_id pode ter leads 'in_progress' ativos em mais
// de um pipeline ao mesmo tempo (ver add_lead_to_pipeline). Usado pra
// mostrar em NegocioSingle que este lead também está ativo em outro lugar.
export const useOtherActiveLeads = (peopleId?: string, excludeLeadId?: string) => {
  return useQuery({
    queryKey: ['negocio-other-active-leads', peopleId, excludeLeadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, leads_pipelines_id, leads_stages_id')
        .eq('people_id', peopleId!)
        .eq('status', 'in_progress')
        .neq('id', excludeLeadId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!peopleId && !!excludeLeadId,
  });
};

export const useAddLeadToPipeline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, targetPipelineId }: { leadId: string; targetPipelineId: string }) => {
      const { data, error } = await supabase.rpc('add_lead_to_pipeline', {
        p_lead_id: leadId,
        p_target_pipeline_id: targetPipelineId,
      });
      if (error) throw error;
      return data as { lead_id: string; leads_stages_id: string; pipeline_name: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negocio-other-active-leads'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
    },
  });
};

// Negocios por etapa
export const useNegociosPorEtapa = (stageId: string, filters?: {
  status?: string;
  user_id?: string;
  teams_id?: string;
  pipelineId?: string;
  dataInicio?: string;
  dataFim?: string;
  campanhaFilter?: string;
}) => {
  return useQuery({
    queryKey: ['negocios-por-etapa', stageId, filters],
    queryFn: async () => {
      console.log('🔍 useNegociosPorEtapa: Buscando negócios para stage:', stageId, 'Filtros:', filters);
      
      let query = supabase
        .from('leads')
        .select(`
          *,
          pessoa:clients_people!leads_people_id_fkey (
            id,
            name,
            email,
            whatsapp,
            service_status,
            ai_enabled
          ),
          pipeline:leads_pipelines!leads_leads_pipelines_id_fkey (
            id,
            name
          ),
          stage:leads_stages!leads_leads_stages_id_fkey (
            id,
            name,
            color
          )
        `)
        .eq('leads_stages_id', stageId);

      // Apply filters
      if (filters?.status) {
        if (filters.status === 'sem-perdidos') {
          query = query.neq('status', 'lost');
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      if (filters?.teams_id) {
        query = query.eq('teams_id', filters.teams_id);
      }

      if (filters?.pipelineId) {
        query = query.eq('leads_pipelines_id', filters.pipelineId);
      }

      if (filters?.dataInicio) {
        query = query.gte('created_at', filters.dataInicio);
      }

      if (filters?.dataFim) {
        query = query.lte('created_at', filters.dataFim);
      }

      if (filters?.campanhaFilter) {
        query = query.eq('utm_campaign', filters.campanhaFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ useNegociosPorEtapa: Erro ao buscar negócios:', error);
        throw error;
      }

      console.log('✅ useNegociosPorEtapa: Negócios encontrados:', data?.length || 0);
      
      // Adicionar aliases de compatibilidade
      const mappedData = (data || []).map((item: any) => ({
        ...item,
        titulo: item.title,
        valor: item.value,
        person_id: item.people_id,
        pessoa: item.pessoa ? {
          ...item.pessoa,
          nome: item.pessoa.name,
          atendimento_ia: item.pessoa.ai_enabled,
          status_atendimento: item.pessoa.service_status
        } : undefined
      }));
      
      return mappedData as Negocio[];
    },
    enabled: !!stageId
  });
};

// Update negocio
export const useUpdateNegocio = () => {
  const queryClient = useQueryClient();
  
  return {
    mutate: async (data: any) => {
      try {
        const { id, controle, titulo, ...restUpdates } = data;
        const updates = {
          ...restUpdates,
          ...(controle !== undefined && { control: controle }),
          ...(titulo !== undefined && { title: titulo })
        };
        console.log('Atualizando negócio:', { id, updates });

        const { error } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', id);
        
        if (error) {
          console.error('Erro no update:', error);
          throw error;
        }
        
        queryClient.invalidateQueries({ queryKey: ['negocios'] });
        queryClient.invalidateQueries({ queryKey: ['negocio', id] });
        queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
        toast.success('Negócio atualizado com sucesso!');
      } catch (error) {
        console.error('Erro ao atualizar negócio:', error);
        toast.error('Erro ao atualizar negócio');
      }
    },
    mutateAsync: async (data: any) => {
      try {
        const { id, controle, titulo, ...restUpdates } = data;
        // Map Portuguese field names to database column names
        const updates = {
          ...restUpdates,
          ...(controle !== undefined && { control: controle }),
          ...(titulo !== undefined && { title: titulo })
        };
        console.log('Atualizando negócio (async):', { id, updates });
        
        const { data: result, error } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.error('Erro no update:', error);
          throw error;
        }
        
        // Audit log
        await auditLogger.log({
          action: 'lead_updated',
          resource_type: 'lead',
          resource_id: id,
          details: {
            fields_changed: Object.keys(updates),
            updates: updates,
            status_changed: updates.status ? true : false
          }
        });
        
        queryClient.invalidateQueries({ queryKey: ['negocios'] });
        queryClient.invalidateQueries({ queryKey: ['negocio', id] });
        queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
        toast.success('Negócio atualizado com sucesso!');
        return result;
      } catch (error) {
        console.error('Erro ao atualizar negócio:', error);
        toast.error('Erro ao atualizar negócio');
        throw error;
      }
    },
    isLoading: false,
    isPending: false
  };
};

// Create negocio
export const useCriarNegocio = (callback?: () => void) => {
  const queryClient = useQueryClient();
  
  return {
    mutate: async (data: any) => {
      try {
        // Map field names to database columns
        const mappedData = {
          people_id: data.person_id || data.people_id,
          leads_pipelines_id: data.pipeline_id || data.leads_pipelines_id,
          leads_stages_id: data.stage_id || data.leads_stages_id,
          user_id: data.user_id,
          teams_id: data.teams_id,
          title: data.titulo || data.title,
          value: data.valor || data.value,
          status: data.status || 'in_progress',
          utm_source: data.utm_source,
          utm_medium: data.utm_medium,
          utm_campaign: data.utm_campaign,
          utm_term: data.utm_term,
          utm_content: data.utm_content,
          metadata: data.metadata
        };

        const { data: result, error } = await supabase
          .from('leads')
          .insert([mappedData])
          .select()
          .single();
        
        if (error) throw error;
        
        // Audit log
        await auditLogger.log({
          action: 'lead_created',
          resource_type: 'lead',
          resource_id: result.id,
          details: {
            title: mappedData.title,
            value: mappedData.value,
            pipeline_id: mappedData.leads_pipelines_id,
            stage_id: mappedData.leads_stages_id,
            people_id: mappedData.people_id
          }
        });
        
        queryClient.invalidateQueries({ queryKey: ['negocios'] });
        queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
        toast.success('Lead created successfully!');
        callback?.();
      } catch (error) {
        console.error('Error creating lead:', error);
        toast.error('Error creating lead');
      }
    },
    mutateAsync: async (data: any) => {
      try {
        // Map field names to database columns
        const mappedData = {
          people_id: data.person_id || data.people_id,
          leads_pipelines_id: data.pipeline_id || data.leads_pipelines_id,
          leads_stages_id: data.stage_id || data.leads_stages_id,
          user_id: data.user_id,
          teams_id: data.teams_id,
          title: data.titulo || data.title,
          value: data.valor || data.value,
          status: data.status || 'in_progress'
        };

        const { data: result, error } = await supabase
          .from('leads')
          .insert([mappedData])
          .select()
          .single();
        
        if (error) throw error;
        
        queryClient.invalidateQueries({ queryKey: ['negocios'] });
        queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
        toast.success('Lead created successfully!');
        callback?.();
        return result;
      } catch (error) {
        console.error('Error creating lead:', error);
        toast.error('Error creating lead');
        throw error;
      }
    },
    isLoading: false,
    isPending: false
  };
};
