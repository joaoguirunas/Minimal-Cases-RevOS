import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Keep existing delete hook export
export { useDeletarPessoa } from './useDeletarPessoa';

// tenantId kept for backward compat — RLS handles tenant isolation
export const usePessoas = (_tenantId?: string) => {
  return useQuery({
    queryKey: ['pessoas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients_people')
        .select(`
          id,
          name,
          email,
          whatsapp,
          status,
          empresas:clients_people_companies(
            empresa:clients_companies(
              id,
              trade_name
            )
          )
        `)
        .neq('status', 'archived')
        .order('name');

      if (error) {
        console.error('Erro ao buscar pessoas:', error);
        return [] as any[];
      }

      // Map to expected shape used across legacy components
      return (data || []).map((p: any) => ({
        id: p.id,
        nome: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        empresas: (p.empresas || []).map((rel: any) => ({
          id: rel?.empresa?.id,
          nome_fantasia: rel?.empresa?.trade_name,
        })),
      }));
    },
  });
};