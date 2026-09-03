import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useMemo, useEffect } from 'react';

// kiwify_lead_products is not yet in the generated Supabase types; access the
// leads query through an untyped view so the nested course join type-checks.
const sbUntyped = supabase as unknown as SupabaseClient;

export interface NegocioOptimized {
  id: string;
  title?: string;
  value?: number;
  status?: string;
  leads_stages_id: string;
  leads_pipelines_id: string;
  people_id?: string;
  company_id?: string;
  user_id?: string;
  teams_id?: string;
  created_at: string;
  updated_at?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  pessoa?: {
    id: string;
    name: string;
    email?: string;
    whatsapp?: string;
    score?: number;
    score_matrix?: { name: string; score_number: number } | null;
    cursos?: { product_id: string; product_name: string }[];
    unread_count?: number;
    first_unread_at?: string | null;
    active_channel_id?: string | null;
    active_channel?: { id: string; label: string; provider: string } | null;
  };
  empresa?: { id: string; trade_name: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
}

interface NegocioFilters {
  stageId?: string;
  status?: string;
  user_id?: string;
  teams_id?: string;
  dataInicio?: string;
  dataFim?: string;
  searchFilter?: string;
  scoreMatrixId?: string;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_term?: string;
  utm_content?: string;
  motivoFilter?: string | null;
  productId?: string;
  tagId?: string;
  channelId?: string;
}

export const useNegociosPipeline = (pipelineId: string, filters?: NegocioFilters) => {
  const queryClient = useQueryClient();

  // Realtime: invalidate whenever any lead is inserted/updated in this pipeline.
  // Debounced — a busy pipeline (bulk import, an active dispatch campaign moving
  // leads stage-by-stage) can emit many events per second; without this, each one
  // re-triggers the full unbounded query above, compounding into "infinite loading".
  useEffect(() => {
    if (!pipelineId) return;
    let isMounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`leads-pipeline-${pipelineId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `leads_pipelines_id=eq.${pipelineId}` },
        () => {
          if (!isMounted) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (isMounted) queryClient.invalidateQueries({ queryKey: ['negocios-pipeline', pipelineId], type: 'active' });
          }, 2000);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[useNegociosPipeline] Realtime subscription error for pipeline', pipelineId);
        }
      });
    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [pipelineId, queryClient]);

  return useQuery({
    queryKey: ['negocios-pipeline', pipelineId, filters],
    queryFn: async () => {
      if (!pipelineId) return [];
      
      // Filtro por produto/canal exige !inner em pessoa (e em cursos, pro produto) —
      // sem isso o PostgREST só filtraria o array aninhado, não as leads retornadas.
      // Só troca pra !inner quando o filtro está ativo, pra não mudar o
      // comportamento (left join) do caso comum sem filtro.
      const pessoaJoin = (filters?.productId || filters?.channelId) ? 'clients_people!inner' : 'clients_people';
      const cursosJoin = filters?.productId ? 'kiwify_lead_products!inner' : 'kiwify_lead_products';
      const tagsJoin = filters?.tagId ? 'leads_tags!inner' : 'leads_tags';

      let query = sbUntyped
        .from('leads')
        .select(`
          *,
          pessoa:${pessoaJoin}(id, name, email, whatsapp, score, unread_count, first_unread_at, score_matrix:score_matrix(name, score_number), cursos:${cursosJoin}(product_id, product_name), active_channel_id, active_channel:settings_whatsapp_channels(id, label, provider)),
          empresa:clients_companies(id, trade_name),
          tags:${tagsJoin}(tag:lead_tags(id, name, color))
        `)
        .eq('leads_pipelines_id', pipelineId);

      if (filters?.productId) query = query.eq('pessoa.cursos.product_id', filters.productId);
      if (filters?.tagId) query = query.eq('tags.tag_id', filters.tagId);
      if (filters?.channelId) query = query.eq('pessoa.active_channel_id', filters.channelId);

      const statusDbMap: Record<string, string> = {
        perdido: 'lost',
        ganho: 'won',
        'em-andamento': 'in_progress',
      };

      if (filters?.stageId) query = query.eq('leads_stages_id', filters.stageId);
      // 'sem-perdidos' esconde perdidos E arquivados — arquivar um lead precisa
      // tirá-lo do kanban (antes só 'lost' saía, e os arquivados continuavam à vista).
      if (filters?.status === 'sem-perdidos') query = query.not('status', 'in', '("lost","archived")');
      else if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', statusDbMap[filters.status] ?? filters.status);
      }
      if (filters?.motivoFilter) query = query.eq('leads_loss_reasons_id', filters.motivoFilter);
      if (filters?.user_id) query = query.eq('user_id', filters.user_id);
      if (filters?.teams_id) query = query.or(`teams_id.eq.${filters.teams_id},teams_id.is.null`);
      if (filters?.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters?.dataFim) query = query.lte('created_at', filters.dataFim);
      if (filters?.utm_campaign) query = query.eq('utm_campaign', filters.utm_campaign);
      if (filters?.utm_source) query = query.eq('utm_source', filters.utm_source);
      if (filters?.utm_medium) query = query.eq('utm_medium', filters.utm_medium);
      if (filters?.utm_term) query = query.eq('utm_term', filters.utm_term);
      if (filters?.utm_content) query = query.eq('utm_content', filters.utm_content);
      if (filters?.searchFilter) {
        query = query.or(`title.ilike.%${filters.searchFilter}%,clients_people.name.ilike.%${filters.searchFilter}%,clients_companies.trade_name.ilike.%${filters.searchFilter}%`);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;

      return (data || []).map((d: any) => ({
        ...d,
        leads_stages_id: d.leads_stages_id,
        leads_pipelines_id: d.leads_pipelines_id,
        pessoa: d.pessoa,
        empresa: d.empresa,
      })) as NegocioOptimized[];
    },
    enabled: !!pipelineId,
  });
};

export const useNegociosByStage = (
  pipelineId: string,
  stageIds: string[],
  filters?: Omit<NegocioFilters, 'stageId'>
) => {
  const { data: allNegocios = [], isLoading } = useNegociosPipeline(pipelineId, filters);

  const negociosByStage = useMemo(() => {
    const grouped: Record<string, NegocioOptimized[]> = {};
    stageIds.forEach(id => { grouped[id] = []; });
    allNegocios.forEach(n => {
      if (n.leads_stages_id && grouped[n.leads_stages_id]) {
        grouped[n.leads_stages_id].push(n);
      } else if (stageIds.length > 0) {
        // Fallback: leads without valid stage go to the first stage column
        grouped[stageIds[0]].push(n);
      }
    });
    return grouped;
  }, [allNegocios, stageIds]);

  const totalByStage = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(negociosByStage).forEach(([stageId, negocios]) => {
      totals[stageId] = negocios.reduce((sum, n) => sum + (n.value || 0), 0);
    });
    return totals;
  }, [negociosByStage]);

  return { negociosByStage, totalByStage, isLoading };
};
