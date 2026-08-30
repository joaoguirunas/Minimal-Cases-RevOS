import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCompaniesPaginated = (page: number, perPage: number, search?: string) => {
  const query = useQuery({
    queryKey: ['companies-paginated', page, perPage, search],
    queryFn: async () => {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let q = supabase.from('clients_companies').select('*', { count: 'exact' });
      if (search) {
        q = q.or(`trade_name.ilike.%${search}%,legal_name.ilike.%${search}%,tax_id.ilike.%${search}%`);
      }

      const { data, error, count } = await q.order('trade_name').range(from, to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  return {
    empresas: query.data?.data || [],
    pagination: {
      total: query.data?.count || 0,
      page,
      perPage,
      totalPages: Math.ceil((query.data?.count || 0) / perPage),
    },
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};
