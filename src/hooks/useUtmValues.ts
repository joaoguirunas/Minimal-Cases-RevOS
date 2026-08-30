import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUtmValues = (pipelineId?: string) => {
  return useQuery({
    queryKey: ['utm-values', pipelineId],
    queryFn: async () => {
      let query = supabase.from('leads').select('utm_campaign, utm_source, utm_medium, utm_term, utm_content');
      if (pipelineId) query = query.eq('leads_pipelines_id', pipelineId);
      
      const { data, error } = await query;
      if (error) throw error;
      
      const campaigns = new Set<string>();
      const sources = new Set<string>();
      const mediums = new Set<string>();
      const terms = new Set<string>();
      const contents = new Set<string>();
      
      (data || []).forEach((d: any) => {
        if (d.utm_campaign) campaigns.add(d.utm_campaign);
        if (d.utm_source) sources.add(d.utm_source);
        if (d.utm_medium) mediums.add(d.utm_medium);
        if (d.utm_term) terms.add(d.utm_term);
        if (d.utm_content) contents.add(d.utm_content);
      });
      
      return {
        campaigns: Array.from(campaigns),
        sources: Array.from(sources),
        mediums: Array.from(mediums),
        terms: Array.from(terms),
        contents: Array.from(contents),
      };
    },
    staleTime: 60000,
  });
};
