import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PessoasFilters {
  hasLeads?: boolean;     // true = com negócio, false = sem negócio, undefined = todos
  statusFilter?: string;  // 'active' | 'inactive' | undefined = todos
}

export const usePessoasPaginadas = (
  tenantId: string,
  page: number,
  perPage: number,
  search?: string,
  showArquivados?: boolean,
  filters?: PessoasFilters
) => {
  const query = useQuery({
    queryKey: ['pessoas-paginadas', tenantId, page, perPage, search, showArquivados, filters],
    queryFn: async () => {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      // Pre-fetch distinct person_ids with leads when filtering by lead presence
      let idsWithLeads: string[] | null = null;
      if (filters?.hasLeads !== undefined) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('people_id')
          .not('people_id', 'is', null)
          .limit(10000);

        idsWithLeads = [...new Set(
          (leadsData || []).map(l => l.people_id).filter(Boolean) as string[]
        )];
      }

      // Short-circuit: "com negócio" but nobody has leads
      if (filters?.hasLeads === true && idsWithLeads !== null && idsWithLeads.length === 0) {
        return { data: [], count: 0, leadCounts: {} };
      }

      let q = supabase
        .from('clients_people')
        .select('*', { count: 'exact' })
        .neq('status', 'merged');

      if (showArquivados) {
        q = q.eq('archived', true);
      } else {
        q = q.or('archived.is.null,archived.eq.false');
      }

      if (filters?.statusFilter) {
        q = q.eq('status', filters.statusFilter);
      }

      if (search) {
        q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`);
      }

      if (idsWithLeads !== null) {
        if (filters?.hasLeads) {
          q = q.in('id', idsWithLeads);
        } else if (idsWithLeads.length > 0) {
          q = q.not('id', 'in', `(${idsWithLeads.join(',')})`);
        }
        // idsWithLeads.length === 0 + hasLeads=false → no extra filter (all are "sem negócio")
      }

      const { data, error, count } = await q.order('name').range(from, to);
      if (error) throw error;

      const pessoas = data || [];

      // Batch-fetch lead counts for the current page
      const leadCounts: Record<string, number> = {};
      if (pessoas.length > 0) {
        const ids = pessoas.map(p => p.id);
        const { data: leadsData } = await supabase
          .from('leads')
          .select('people_id')
          .in('people_id', ids);

        (leadsData || []).forEach(l => {
          if (l.people_id) leadCounts[l.people_id] = (leadCounts[l.people_id] || 0) + 1;
        });
      }

      return { data: pessoas, count: count || 0, leadCounts };
    },
    enabled: !!tenantId,
  });

  return {
    pessoas: query.data?.data || [],
    leadCounts: query.data?.leadCounts || {},
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
