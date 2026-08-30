import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScoreInvestment {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const db = () => supabase as unknown as { from: (t: string) => any };

const fetchInvestmentsCategoryId = async (): Promise<string | null> => {
  const { data } = await db()
    .from('score_categories')
    .select('id')
    .eq('slug', 'investments')
    .single();
  return data?.id ?? null;
};

export const useScoreInvestments = () => {
  return useQuery({
    queryKey: ['score-investments'],
    queryFn: async () => {
      const catId = await fetchInvestmentsCategoryId();
      if (!catId) return [];
      const { data, error } = await db()
        .from('score_category_items')
        .select('*')
        .eq('category_id', catId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as ScoreInvestment[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCreateScoreInvestment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (investment: Omit<ScoreInvestment, 'id' | 'created_at' | 'updated_at' | 'order_index'>) => {
      const catId = await fetchInvestmentsCategoryId();
      if (!catId) throw new Error('Categoria Faixas de Investimento não encontrada');
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
        .insert({ ...investment, active: true, category_id: catId, order_index: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-investments'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Faixa de investimento criada com sucesso!');
    },
    onError: () => toast.error('Erro ao criar faixa de investimento'),
  });
};

export const useUpdateScoreInvestment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScoreInvestment> & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['score-investments'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Faixa de investimento atualizada com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar faixa de investimento'),
  });
};

export const useDeleteScoreInvestment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('score_category_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-investments'] });
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      toast.success('Faixa de investimento excluída com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir faixa de investimento'),
  });
};

export const useReorderScoreInvestments = () => {
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
      queryClient.invalidateQueries({ queryKey: ['score-investments'] });
    },
    onError: () => toast.error('Erro ao reordenar faixas de investimento'),
  });
};
