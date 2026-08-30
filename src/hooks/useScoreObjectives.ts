import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Same interface — backward compatible with PersonScoreSection / NegocioScoreSection
export interface ScoreObjective {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const db = () => supabase as unknown as { from: (t: string) => any };

const fetchObjectivesCategoryId = async (): Promise<string | null> => {
  const { data } = await db()
    .from('score_categories')
    .select('id')
    .eq('slug', 'objectives')
    .single();
  return data?.id ?? null;
};

// Reads from score_category_items WHERE category slug = 'objectives'
export const useScoreObjectives = () => {
  return useQuery({
    queryKey: ['score-objectives'],
    queryFn: async () => {
      const catId = await fetchObjectivesCategoryId();
      if (!catId) return [];
      const { data, error } = await db()
        .from('score_category_items')
        .select('*')
        .eq('category_id', catId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as ScoreObjective[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCreateScoreObjective = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (objective: Omit<ScoreObjective, 'id' | 'created_at' | 'updated_at' | 'order_index'>) => {
      const catId = await fetchObjectivesCategoryId();
      if (!catId) throw new Error('Categoria Objetivos não encontrada');
      const { data: maxData } = await db()
        .from('score_category_items')
        .select('order_index')
        .eq('category_id', catId)
        .order('order_index', { ascending: false })
        .limit(1)
        .single();
      const nextOrder = (maxData?.order_index ?? -1) + 1;
      const { data, error } = await db()
        .from('score_category_items')
        .insert({ ...objective, category_id: catId, order_index: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Objetivo criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar objetivo'),
  });
};

export const useUpdateScoreObjective = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScoreObjective> & { id: string }) => {
      const { data, error } = await db()
        .from('score_category_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Objetivo atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar objetivo'),
  });
};

export const useDeleteScoreObjective = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('score_category_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Objetivo excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir objetivo'),
  });
};

export const useReorderScoreObjectives = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reorderedItems: { id: string; order_index: number }[]) => {
      await Promise.all(
        reorderedItems.map((item) =>
          db().from('score_category_items').update({ order_index: item.order_index }).eq('id', item.id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-objectives'] });
    },
    onError: () => toast.error('Erro ao reordenar objetivos'),
  });
};
