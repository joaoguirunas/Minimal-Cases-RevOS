import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// kiwify_lead_products is not yet in the generated Supabase types.
const sbUntyped = supabase as unknown as SupabaseClient;

export interface KiwifyProductOption {
  product_id: string;
  product_name: string;
}

/** Produtos Kiwify distintos entre os leads do pipeline atual — mesmo padrão de useUtmValues, só que escopado ao catálogo real em vez de todo o Kiwify. */
export const useKiwifyProductsInPipeline = (pipelineId?: string) => {
  return useQuery({
    queryKey: ['kiwify-products-in-pipeline', pipelineId],
    queryFn: async (): Promise<KiwifyProductOption[]> => {
      if (!pipelineId) return [];

      const { data, error } = await sbUntyped
        .from('leads')
        .select('pessoa:clients_people!inner(cursos:kiwify_lead_products!inner(product_id, product_name))')
        .eq('leads_pipelines_id', pipelineId);

      if (error) throw error;

      const map = new Map<string, string>();
      (data ?? []).forEach((row: any) => {
        const cursos = row.pessoa?.cursos ?? [];
        cursos.forEach((c: { product_id: string; product_name: string }) => {
          if (c.product_id && !map.has(c.product_id)) map.set(c.product_id, c.product_name);
        });
      });

      return Array.from(map.entries()).map(([product_id, product_name]) => ({ product_id, product_name }));
    },
    enabled: !!pipelineId,
    staleTime: 60_000,
  });
};
