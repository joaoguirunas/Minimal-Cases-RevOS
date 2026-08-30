import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Lead {
  id: string;
  people_id: string;
  company_id?: string;
  leads_pipelines_id: string;
  leads_stages_id: string;
  user_id?: string;
  teams_id?: string;
  leads_loss_reasons_id?: string;
  title?: string;
  value?: number;
  status: string;
  control?: string;
  loss_reason?: string;
  last_interaction?: string;
  last_interaction_at?: string;
  won_at?: string;
  external_crm_lead_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  fb_lead_id?: string;
  metadata?: any;
  recomendante?: string;
  relacao_recomendante?: string;
  relacao_corretor?: string;
  nome_evento?: string;
  origem_lista?: string;
  created_at: string;
  updated_at: string;
}

export const useLeads = (filters?: { status?: string; pipeline_id?: string; stage_id?: string }) => {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.pipeline_id) {
        query = query.eq('leads_pipelines_id', filters.pipeline_id);
      }
      if (filters?.stage_id) {
        query = query.eq('leads_stages_id', filters.stage_id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Lead[];
    },
  });
};

export const useLead = (id: string) => {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!id,
  });
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('leads')
        .insert([lead])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar lead: ' + error.message);
    },
  });
};

export const useUpdateLead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      toast.success('Lead atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar lead: ' + error.message);
    },
  });
};

export const useDeleteLead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deletado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao deletar lead: ' + error.message);
    },
  });
};

export const useLeadsUpdates = (leadId: string) => {
  return useQuery({
    queryKey: ['leads-updates', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_updates')
        .select('*')
        .eq('lead_id', leadId)
        .order('changed_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });
};
