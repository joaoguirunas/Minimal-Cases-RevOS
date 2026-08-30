import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCompanyAssociations = (companyIds: string[]) => {
  return useQuery({
    queryKey: ['company-associations', companyIds],
    queryFn: async () => {
      if (!companyIds.length) return {};
      
      const associations: Record<string, { peopleCount: number; leadsCount: number }> = {};
      
      const { data: peopleData } = await supabase
        .from('clients_people_companies')
        .select('company_id')
        .in('company_id', companyIds);
      
      const { data: leadsData } = await supabase
        .from('leads')
        .select('company_id')
        .in('company_id', companyIds);
      
      companyIds.forEach(id => {
        associations[id] = {
          peopleCount: (peopleData || []).filter(p => p.company_id === id).length,
          leadsCount: (leadsData || []).filter(l => l.company_id === id).length,
        };
      });
      
      return associations;
    },
    enabled: companyIds.length > 0,
  });
};
