import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Pipeline {
  id: string;
  name: string;
  nome: string;
  description?: string;
  descricao?: string;
  active: boolean;
  ativo: boolean;
  order_index: number;
  created_at?: string;
  kiwify_product_id?: string | null;
  kiwify_product_name?: string | null;
}

export interface Stage {
  id: string;
  name: string;
  nome: string;
  color?: string;
  cor?: string;
  order_index: number;
  ordem: number;
  leads_pipelines_id: string;
  pipeline_id: string;
  active?: boolean;
  ativo?: boolean;
  ai_priority?: boolean;
}

export const usePipelines = () => {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_pipelines')
        .select('*')
        .eq('active', true)
        .order('order_index');
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        nome: p.name,
        descricao: p.description,
        ativo: p.active ?? true,
        order_index: p.order_index ?? 0,
      })) as Pipeline[];
    },
  });
};

export const useStages = () => {
  return useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_stages')
        .select('*')
        .eq('active', true)
        .order('order_index');
      if (error) throw error;
      return (data || []).map(s => ({
        ...s,
        nome: s.name,
        cor: s.color,
        ordem: s.order_index,
        pipeline_id: s.leads_pipelines_id,
        ativo: s.active ?? true,
      })) as Stage[];
    },
  });
};

export const useCreatePipeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Pipeline>) => {
      const { data: result, error } = await supabase.from('leads_pipelines').insert([{ name: data.name || data.nome || '', description: data.description || data.descricao, active: true }]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); toast.success('Pipeline criado!'); },
  });
};

export const useUpdatePipeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome, descricao, ativo, order_index, ...rest }: Partial<Pipeline> & { id: string }) => {
      const payload: Record<string, unknown> = { ...rest };
      if (nome !== undefined) payload.name = nome;
      if (descricao !== undefined) payload.description = descricao;
      if (ativo !== undefined) payload.active = ativo;
      if (order_index !== undefined) payload.order_index = order_index;
      const { error } = await supabase.from('leads_pipelines').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); toast.success('Pipeline atualizado!'); },
  });
};

export const useReorderPipelines = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('leads_pipelines').update({ order_index: index }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); },
  });
};

export const useDeletePipeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads_pipelines').update({ active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); toast.success('Pipeline removido!'); },
  });
};

export const useCreateStage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Stage>) => {
      const { data: result, error } = await supabase.from('leads_stages').insert([{ name: data.name || data.nome || '', leads_pipelines_id: data.leads_pipelines_id || data.pipeline_id, order_index: data.order_index || data.ordem || 0, color: data.color || data.cor }]).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stages'] }); toast.success('Etapa criada!'); },
  });
};

export const useUpdateStage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome, cor, ordem, order_index, pipeline_id, ativo, ...rest }: Partial<Stage> & { id: string }) => {
      const payload: Record<string, unknown> = { ...rest };
      if (nome !== undefined) payload.name = nome;
      if (cor !== undefined) payload.color = cor;
      if (ordem !== undefined) payload.order_index = ordem;
      if (order_index !== undefined) payload.order_index = order_index;
      if (pipeline_id !== undefined) payload.leads_pipelines_id = pipeline_id;
      if (ativo !== undefined) payload.active = ativo;
      const { error } = await supabase.from('leads_stages').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stages'] }); },
  });
};
