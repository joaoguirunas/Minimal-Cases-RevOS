import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadsPipeline {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadsStage {
  id: string;
  leads_pipelines_id: string;
  name: string;
  order_index: number;
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const useLeadsPipelines = () => {
  return useQuery({
    queryKey: ['leads-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_pipelines')
        .select('*')
        .eq('active', true)
        .order('created_at');
      
      if (error) throw error;
      return (data || []) as LeadsPipeline[];
    },
  });
};

export const useLeadsStages = (pipelineId?: string) => {
  return useQuery({
    queryKey: ['leads-stages', pipelineId],
    queryFn: async () => {
      let query = supabase
        .from('leads_stages')
        .select('*')
        .eq('active', true);
      
      if (pipelineId) {
        query = query.eq('leads_pipelines_id', pipelineId);
      }
      
      const { data, error } = await query.order('order_index');
      
      if (error) throw error;
      return (data || []) as LeadsStage[];
    },
  });
};

export const useCreateLeadsPipeline = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pipeline: any) => {
      const { data, error } = await supabase
        .from('leads_pipelines')
        .insert([pipeline])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-pipelines'] });
      toast.success('Pipeline criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar pipeline: ' + error.message);
    },
  });
};

export const useUpdateLeadsPipeline = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadsPipeline> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads_pipelines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-pipelines'] });
      toast.success('Pipeline atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar pipeline: ' + error.message);
    },
  });
};

export const useCreateLeadsStage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stage: any) => {
      const { data, error } = await supabase
        .from('leads_stages')
        .insert([stage])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-stages'] });
      toast.success('Etapa criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar etapa: ' + error.message);
    },
  });
};

export const useUpdateLeadsStage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadsStage> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-stages'] });
      toast.success('Etapa atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar etapa: ' + error.message);
    },
  });
};
