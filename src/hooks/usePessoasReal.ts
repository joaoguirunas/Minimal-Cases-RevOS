import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Pessoa {
  id: string;
  name: string;
  email?: string;
  whatsapp?: string;
  document?: string;
  score?: number;
  status?: string;
  service_status?: string;
  ai_enabled?: boolean;
  source?: string;
  notes?: string;
  type?: string;
  income?: string;
  moment?: string;
  goal?: string;
  disc_profile?: string;
  disc_summary?: string;
  conversation_summary?: string;
  score_matrix_id?: string;
  score_framing_id?: string;
  score_investment_id?: string;
  score_objective_id?: string;
  created_at?: string;
  updated_at?: string;
  
  // Qualificação IA - Diagnóstico (Q1-Q8)
  q1_main_bottleneck?: string | null;
  q2_lead_volume_month?: string | null;
  q3_team_size?: string | null;
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
  q21_interest_level?: string | null;
  q22_close_probability?: string | null;
  q23_behavioral_tags?: string | null;
  q24_last_update_by_agent?: string | null;
  
  // Qualificação IA - DISC (Q25)
  q25_disc_profile?: string | null;
  
  instagram_user_id?: string | null;

  // Backward compatibility
  nome?: string;
  documento?: string;
  status_atendimento?: string;
  atendimento_ia?: boolean;
  origem?: string;
  observacoes?: string;
  tipo?: string;
  renda?: string;
  momento?: string;
  objetivo?: string;
  disc?: string;
  disc_resumo?: string;
  resumo_conversa?: string;
}

export const usePessoas = (filters?: {
  search?: string;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['pessoas', filters],
    queryFn: async () => {
      let query = supabase
        .from('clients_people')
        .select('*')
        .neq('status', 'merged');  // never show auto-merged duplicate records

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,whatsapp.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      // Add backward compatibility aliases
      const mappedData = (data || []).map(item => ({
        ...item,
        nome: item.name,
        documento: item.document,
        status_atendimento: item.service_status,
        atendimento_ia: item.ai_enabled,
        origem: item.source,
        observacoes: item.notes,
        tipo: item.type,
        resumo_conversa: item.conversation_summary,
        disc_resumo: item.disc_summary,
      }));
      
      return mappedData as Pessoa[];
    },
  });
};

export const usePessoa = (id: string) => {
  return useQuery({
    queryKey: ['pessoa', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients_people')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Add backward compatibility aliases
      return {
        ...data,
        nome: data.name,
        documento: data.document,
        status_atendimento: data.service_status,
        atendimento_ia: data.ai_enabled,
        origem: data.source,
        observacoes: data.notes,
        tipo: data.type,
        resumo_conversa: data.conversation_summary,
        disc_resumo: data.disc_summary,
      } as Pessoa;
    },
    enabled: !!id,
  });
};

export const useCreatePessoa = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pessoa: Partial<Pessoa>) => {
      // Map old field names to new ones
      const mappedPessoa: any = {
        name: pessoa.nome || pessoa.name,
        document: pessoa.documento || pessoa.document,
        service_status: pessoa.status_atendimento || pessoa.service_status,
        ai_enabled: pessoa.atendimento_ia !== undefined ? pessoa.atendimento_ia : pessoa.ai_enabled,
        source: pessoa.origem || pessoa.source,
        notes: pessoa.observacoes || pessoa.notes,
        type: pessoa.tipo || pessoa.type,
        email: pessoa.email,
        whatsapp: pessoa.whatsapp,
        score: pessoa.score,
        status: pessoa.status,
        score_framing_id: pessoa.score_framing_id,
        score_investment_id: pessoa.score_investment_id,
        score_objective_id: pessoa.score_objective_id
      };
      
      const { data, error } = await supabase
        .from('clients_people')
        .insert([mappedPessoa])
        .select()
        .single();

      if (error) throw error;
      
      // Add backward compatibility aliases
      return {
        ...data,
        nome: data.name,
        documento: data.document,
        status_atendimento: data.service_status,
        atendimento_ia: data.ai_enabled,
        origem: data.source,
        observacoes: data.notes,
        tipo: data.type
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pessoas'] });
    },
  });
};

export const useUpdatePessoa = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...pessoa }: Partial<Pessoa> & { id: string }) => {
      // Map old field names to new ones and pass questionnaire fields directly
      const mappedPessoa: any = {};
      if (pessoa.nome || pessoa.name) {
        mappedPessoa.name = pessoa.nome || pessoa.name;
      }
      if (pessoa.documento || pessoa.document) {
        mappedPessoa.document = pessoa.documento || pessoa.document;
      }
      if (pessoa.status_atendimento || pessoa.service_status) {
        mappedPessoa.service_status = pessoa.status_atendimento || pessoa.service_status;
      }
      if (pessoa.atendimento_ia !== undefined || pessoa.ai_enabled !== undefined) {
        mappedPessoa.ai_enabled = pessoa.atendimento_ia !== undefined ? pessoa.atendimento_ia : pessoa.ai_enabled;
      }
      if (pessoa.origem || pessoa.source) {
        mappedPessoa.source = pessoa.origem || pessoa.source;
      }
      if (pessoa.observacoes || pessoa.notes) {
        mappedPessoa.notes = pessoa.observacoes || pessoa.notes;
      }
      if (pessoa.tipo || pessoa.type) {
        mappedPessoa.type = pessoa.tipo || pessoa.type;
      }
      if (pessoa.email) mappedPessoa.email = pessoa.email;
      if (pessoa.whatsapp) mappedPessoa.whatsapp = pessoa.whatsapp;
      if (pessoa.instagram_user_id !== undefined) mappedPessoa.instagram_user_id = pessoa.instagram_user_id;
      if (pessoa.score !== undefined) mappedPessoa.score = pessoa.score;
      if (pessoa.status) mappedPessoa.status = pessoa.status;
      if (pessoa.income) mappedPessoa.income = pessoa.income;
      if (pessoa.moment) mappedPessoa.moment = pessoa.moment;
      if (pessoa.goal) mappedPessoa.goal = pessoa.goal;
      if (pessoa.disc_profile) mappedPessoa.disc_profile = pessoa.disc_profile;
      if (pessoa.score_framing_id !== undefined) mappedPessoa.score_framing_id = pessoa.score_framing_id;
      if (pessoa.score_investment_id !== undefined) mappedPessoa.score_investment_id = pessoa.score_investment_id;
      if (pessoa.score_objective_id !== undefined) mappedPessoa.score_objective_id = pessoa.score_objective_id;
      if (pessoa.score_matrix_id !== undefined) mappedPessoa.score_matrix_id = pessoa.score_matrix_id;
      
      // Qualificação IA fields (q1 - q26)
      // Diagnóstico (Q1-Q8)
      if ((pessoa as any).q1_main_bottleneck !== undefined) mappedPessoa.q1_main_bottleneck = (pessoa as any).q1_main_bottleneck;
      if ((pessoa as any).q2_lead_volume_month !== undefined) mappedPessoa.q2_lead_volume_month = (pessoa as any).q2_lead_volume_month;
      if ((pessoa as any).q3_team_size !== undefined) mappedPessoa.q3_team_size = (pessoa as any).q3_team_size;
      if ((pessoa as any).q4_crm_maturity !== undefined) mappedPessoa.q4_crm_maturity = (pessoa as any).q4_crm_maturity;
      if ((pessoa as any).q5_crm_name !== undefined) mappedPessoa.q5_crm_name = (pessoa as any).q5_crm_name;
      if ((pessoa as any).q6_trigger !== undefined) mappedPessoa.q6_trigger = (pessoa as any).q6_trigger;
      if ((pessoa as any).q7_problem_impact !== undefined) mappedPessoa.q7_problem_impact = (pessoa as any).q7_problem_impact;
      if ((pessoa as any).q8_engagement_level !== undefined) mappedPessoa.q8_engagement_level = (pessoa as any).q8_engagement_level;
      
      // Qualificação (Q9-Q20)
      if ((pessoa as any).q9_decision_authority !== undefined) mappedPessoa.q9_decision_authority = (pessoa as any).q9_decision_authority;
      if ((pessoa as any).q10_stakeholders !== undefined) mappedPessoa.q10_stakeholders = (pessoa as any).q10_stakeholders;
      if ((pessoa as any).q11_budget_approved !== undefined) mappedPessoa.q11_budget_approved = (pessoa as any).q11_budget_approved;
      if ((pessoa as any).q12_timeline !== undefined) mappedPessoa.q12_timeline = (pessoa as any).q12_timeline;
      if ((pessoa as any).q13_urgency_reason !== undefined) mappedPessoa.q13_urgency_reason = (pessoa as any).q13_urgency_reason;
      if ((pessoa as any).q14_data_ready !== undefined) mappedPessoa.q14_data_ready = (pessoa as any).q14_data_ready;
      if ((pessoa as any).q15_minimum_volume !== undefined) mappedPessoa.q15_minimum_volume = (pessoa as any).q15_minimum_volume;
      if ((pessoa as any).q16_expected_roi !== undefined) mappedPessoa.q16_expected_roi = (pessoa as any).q16_expected_roi;
      if ((pessoa as any).q17_objections !== undefined) mappedPessoa.q17_objections = (pessoa as any).q17_objections;
      if ((pessoa as any).q18_real_fit !== undefined) mappedPessoa.q18_real_fit = (pessoa as any).q18_real_fit;
      if ((pessoa as any).q19_qualification_status !== undefined) mappedPessoa.q19_qualification_status = (pessoa as any).q19_qualification_status;
      if ((pessoa as any).q20_rejection_reason !== undefined) mappedPessoa.q20_rejection_reason = (pessoa as any).q20_rejection_reason;
      
      // Análise (Q21-Q24)
      if ((pessoa as any).q21_interest_level !== undefined) mappedPessoa.q21_interest_level = (pessoa as any).q21_interest_level;
      if ((pessoa as any).q22_close_probability !== undefined) mappedPessoa.q22_close_probability = (pessoa as any).q22_close_probability;
      if ((pessoa as any).q23_behavioral_tags !== undefined) mappedPessoa.q23_behavioral_tags = (pessoa as any).q23_behavioral_tags;
      if ((pessoa as any).q24_last_update_by_agent !== undefined) mappedPessoa.q24_last_update_by_agent = (pessoa as any).q24_last_update_by_agent;
      
      // DISC (Q25-Q26)
      if ((pessoa as any).q25_disc_profile !== undefined) mappedPessoa.q25_disc_profile = (pessoa as any).q25_disc_profile;
      
      const { data, error } = await supabase
        .from('clients_people')
        .update(mappedPessoa)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Add backward compatibility aliases
      return {
        ...data,
        nome: data.name,
        documento: data.document,
        status_atendimento: data.service_status,
        atendimento_ia: data.ai_enabled,
        origem: data.source,
        observacoes: data.notes,
        tipo: data.type
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pessoas'] });
      queryClient.invalidateQueries({ queryKey: ['pessoa'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['negocio'] });
    },
  });
};
