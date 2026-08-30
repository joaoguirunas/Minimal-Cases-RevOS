import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScoreCategory {
  id: string;
  name: string;
  slug: string | null;
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScoreCategoryItem {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export const useScoreCategories = () => {
  return useQuery({
    queryKey: ['score-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('score_categories' as 'score_objectives') // cast: not in types.ts yet
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ScoreCategory[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCreateScoreCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string }) => {
      const { data: maxData } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_categories')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)
        .single();
      const nextOrder = (maxData?.order_index ?? -1) + 1;
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_categories')
        .insert({ name: payload.name, order_index: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as ScoreCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-categories'] });
      toast.success('Categoria criada com sucesso!');
    },
    onError: () => toast.error('Erro ao criar categoria'),
  });
};

export const useUpdateScoreCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScoreCategory> & { id: string }) => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScoreCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-categories'] });
      toast.success('Categoria atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar categoria'),
  });
};

export const useDeleteScoreCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-categories'] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items'] });
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      toast.success('Categoria excluída!');
    },
    onError: () => toast.error('Erro ao excluir categoria'),
  });
};

export const useReorderScoreCategories = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; order_index: number }[]) => {
      await Promise.all(
        items.map((item) =>
          (supabase as unknown as { from: (t: string) => any })
            .from('score_categories')
            .update({ order_index: item.order_index })
            .eq('id', item.id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-categories'] });
    },
    onError: () => toast.error('Erro ao reordenar categorias'),
  });
};

// ─── Category Items ───────────────────────────────────────────────────────────

export const useScoreCategoryItems = (categoryId?: string) => {
  return useQuery({
    queryKey: ['score-category-items', categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_category_items')
        .select('*')
        .eq('category_id', categoryId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as ScoreCategoryItem[];
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Fetches ALL items across all categories (used for matrix name resolution)
export const useAllScoreCategoryItems = () => {
  return useQuery({
    queryKey: ['score-category-items-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_category_items')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as ScoreCategoryItem[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCreateScoreCategoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { category_id: string; name: string; active?: boolean }) => {
      const { data: maxData } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_category_items')
        .select('order_index')
        .eq('category_id', payload.category_id)
        .order('order_index', { ascending: false })
        .limit(1)
        .single();
      const nextOrder = (maxData?.order_index ?? -1) + 1;
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_category_items')
        .insert({ ...payload, active: payload.active ?? true, order_index: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as ScoreCategoryItem;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['score-category-items', variables.category_id] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      // Also invalidate legacy keys so PersonScoreSection picks up new items
      queryClient.invalidateQueries({ queryKey: ['score-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['score-investments'] });
      queryClient.invalidateQueries({ queryKey: ['score-framings'] });
      toast.success('Item criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar item'),
  });
};

export const useUpdateScoreCategoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScoreCategoryItem> & { id: string }) => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_category_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScoreCategoryItem;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['score-category-items', variables.category_id] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      queryClient.invalidateQueries({ queryKey: ['score-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['score-investments'] });
      queryClient.invalidateQueries({ queryKey: ['score-framings'] });
      toast.success('Item atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar item'),
  });
};

export const useDeleteScoreCategoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from('score_category_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { category_id };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['score-category-items', variables.category_id] });
      queryClient.invalidateQueries({ queryKey: ['score-category-items-all'] });
      queryClient.invalidateQueries({ queryKey: ['score-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['score-investments'] });
      queryClient.invalidateQueries({ queryKey: ['score-framings'] });
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      toast.success('Item excluído!');
    },
    onError: () => toast.error('Erro ao excluir item'),
  });
};

export const useReorderScoreCategoryItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryId,
      items,
    }: {
      categoryId: string;
      items: { id: string; order_index: number }[];
    }) => {
      await Promise.all(
        items.map((item) =>
          (supabase as unknown as { from: (t: string) => any })
            .from('score_category_items')
            .update({ order_index: item.order_index })
            .eq('id', item.id)
        )
      );
      return { categoryId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['score-category-items', variables.categoryId] });
    },
    onError: () => toast.error('Erro ao reordenar itens'),
  });
};
