import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScoreFraming {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const db = () => supabase as unknown as { from: (t: string) => any };

const fetchFramingsCategoryId = async (): Promise<string | null> => {
  const { data } = await db()
    .from('score_categories')
    .select('id')
    .eq('slug', 'framings')
    .single();
  return data?.id ?? null;
};

export const useScoreFramings = () => {
  return useQuery({
    queryKey: ['score-framings'],
    queryFn: async () => {
      const catId = await fetchFramingsCategoryId();
      if (!catId) return [];
      const { data, error } = await db()
        .from('score_category_items')
        .select('*')
        .eq('category_id', catId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as ScoreFraming[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCreateScoreFraming = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (framing: Omit<ScoreFraming, 'id' | 'created_at' | 'updated_at' | 'order_index'>) => {
      const catId = await fetchFramingsCategoryId();
      if (!catId) throw new Error('Categoria Segmentos não encontrada');
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
        .insert({ ...framing, category_id: catId, order_index: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-framings'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Segmento criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar segmento'),
  });
};

export const useUpdateScoreFraming = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScoreFraming> & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['score-framings'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Segmento atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar segmento'),
  });
};

export const useDeleteScoreFraming = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('score_category_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-framings'] });
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Segmento excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir segmento'),
  });
};

export const useReorderScoreFramings = () => {
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
      queryClient.invalidateQueries({ queryKey: ['score-framings'] });
    },
    onError: () => toast.error('Erro ao reordenar segmentos'),
  });
};
