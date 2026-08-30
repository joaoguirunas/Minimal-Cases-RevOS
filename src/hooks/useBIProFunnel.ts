import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDateFilter } from '@/hooks/bipro-date-utils';

export interface FunnelStageMetrics {
  stageId: string;
  stageName: string;
  stageOrder: number;
  stageColor: string | null;
  totalLeads: number;
  activeLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  avgDaysInStage: number;
  totalValue: number;
  avgValue: number;
}

export interface FunnelMetrics {
  pipelineId: string;
  pipelineName: string;
  stages: FunnelStageMetrics[];
  totalLeadsEntered: number;
  totalLeadsWon: number;
  totalLeadsLost: number;
  overallConversionRate: number;
  totalRevenue: number;
  avgSalesCycle: number;
  schedulingRate: number;
  appointmentShowRate: number;
  appointmentToWonRate: number;
  bottleneckStageId: string | null;
  bottleneckDropRate: number;
}

export interface UseBIProFunnelOptions {
  pipelineId?: string;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  scoreFilter?: number[];
}

export function useBIProFunnel(options: UseBIProFunnelOptions = {}) {
  const { pipelineId, period = 'all', dateFrom, dateTo, scoreFilter } = options;

  const dateRange = useMemo(
    () => buildDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-funnel', pipelineId, period, dateFrom, dateTo, scoreFilter];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<FunnelMetrics[]> => {
      // 1. Fetch pipelines
      let pipelinesQuery = supabase
        .from('leads_pipelines')
        .select('id, name')
        .order('created_at', { ascending: true });

      if (pipelineId && pipelineId !== 'all') {
        pipelinesQuery = pipelinesQuery.eq('id', pipelineId);
      }

      const { data: pipelines, error: pipelinesError } = await pipelinesQuery;
      if (pipelinesError) throw pipelinesError;
      if (!pipelines?.length) return [];

      // 2. Fetch all stages for these pipelines
      const pipelineIds = pipelines.map(p => p.id);
      const { data: stages, error: stagesError } = await supabase
        .from('leads_stages')
        .select('id, name, order_index, color, leads_pipelines_id')
        .in('leads_pipelines_id', pipelineIds)
        .order('order_index', { ascending: true });

      if (stagesError) throw stagesError;

      // 3. Fetch leads with stage and pipeline info
      let leadsQuery = supabase
        .from('leads')
        .select('id, value, status, created_at, updated_at, won_at, leads_stages_id, leads_stages!inner(id, leads_pipelines_id)');

      if (pipelineId && pipelineId !== 'all') {
        leadsQuery = leadsQuery.eq('leads_stages.leads_pipelines_id', pipelineId);
      } else {
        leadsQuery = leadsQuery.in('leads_stages.leads_pipelines_id', pipelineIds);
      }

      if (scoreFilter && scoreFilter.length > 0) {
        leadsQuery = leadsQuery
          .select('id, value, status, created_at, updated_at, won_at, leads_stages_id, leads_stages!inner(id, leads_pipelines_id), clients_people!inner(score)')
          .in('clients_people.score', scoreFilter);
      }
      if (dateRange) {
        leadsQuery = leadsQuery
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to);
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // 4. Fetch meetings (for scheduling rate)
      let meetingsQuery = supabase
        .from('meetings')
        .select('id, lead_id, status');

      if (dateRange) {
        meetingsQuery = meetingsQuery
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to);
      }

      const { data: meetings } = await meetingsQuery;

      // 5. Build metrics per pipeline
      const funnelMetrics: FunnelMetrics[] = pipelines.map(pipeline => {
        const pipelineStages = (stages || [])
          .filter(s => s.leads_pipelines_id === pipeline.id)
          .sort((a, b) => a.order_index - b.order_index);

        const pipelineLeads = (leads || []).filter(
          l => l.leads_stages?.leads_pipelines_id === pipeline.id
        );

        const wonLeads = pipelineLeads.filter(l => l.status === 'won');
        const lostLeads = pipelineLeads.filter(l => l.status === 'lost');
        const totalRevenue = wonLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const totalLeadsEntered = pipelineLeads.length;
        const overallConversionRate = totalLeadsEntered > 0
          ? (wonLeads.length / totalLeadsEntered) * 100
          : 0;

        // Avg sales cycle: days from created_at to won_at (fallback updated_at) for won leads
        const salesCycles = wonLeads.map(l => {
          const created = new Date(l.created_at).getTime();
          const closed = l.won_at ? new Date(l.won_at).getTime() : new Date(l.updated_at).getTime();
          return (closed - created) / (1000 * 60 * 60 * 24);
        }).filter(d => d > 0);
        const avgSalesCycle = salesCycles.length > 0
          ? salesCycles.reduce((a, b) => a + b, 0) / salesCycles.length
          : 0;

        // Scheduling rate
        const leadsWithMeeting = new Set(
          (meetings || []).filter(m => pipelineLeads.some(l => l.id === m.lead_id))
            .map(m => m.lead_id)
        );
        const schedulingRate = totalLeadsEntered > 0
          ? (leadsWithMeeting.size / totalLeadsEntered) * 100
          : 0;

        const attendedMeetings = (meetings || []).filter(
          m => m.status === 'compareceu'
        );
        const appointmentShowRate = meetings?.length > 0
          ? (attendedMeetings.length / meetings.length) * 100
          : 0;

        const wonLeadIds = new Set(wonLeads.map(l => l.id));
        const meetingsWithWon = (meetings || []).filter(m => wonLeadIds.has(m.lead_id));
        const appointmentToWonRate = meetings?.length > 0
          ? (meetingsWithWon.length / meetings.length) * 100
          : 0;

        // Build stage-level metrics
        const stageMetrics: FunnelStageMetrics[] = pipelineStages.map((stage, idx) => {
          const stageLeads = pipelineLeads.filter(l => l.leads_stages_id === stage.id);
          const activeLeads = stageLeads.filter(l => l.status === 'in_progress');
          const lostInStage = stageLeads.filter(l => l.status === 'lost');

          // Converted = leads that moved past this stage (approximation: leads in later stages)
          const laterStages = pipelineStages.slice(idx + 1).map(s => s.id);
          const convertedLeads = pipelineLeads.filter(l => laterStages.includes(l.leads_stages_id)).length;

          const totalInStage = stageLeads.length + convertedLeads;
          const conversionRate = totalInStage > 0
            ? (convertedLeads / totalInStage) * 100
            : 0;

          // Avg days in stage using updated_at as proxy
          const avgDaysInStage = stageLeads.length > 0
            ? stageLeads.reduce((sum, l) => {
                const days = (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime())
                  / (1000 * 60 * 60 * 24);
                return sum + Math.max(0, days);
              }, 0) / stageLeads.length
            : 0;

          const totalValue = stageLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
          const avgValue = stageLeads.length > 0 ? totalValue / stageLeads.length : 0;

          return {
            stageId: stage.id,
            stageName: stage.name,
            stageOrder: stage.order_index,
            stageColor: stage.color,
            totalLeads: stageLeads.length,
            activeLeads: activeLeads.length,
            convertedLeads,
            lostLeads: lostInStage.length,
            conversionRate,
            avgDaysInStage,
            totalValue,
            avgValue,
          };
        });

        // Bottleneck: stage with biggest relative conversion drop vs previous stage
        let bottleneckStageId: string | null = null;
        let bottleneckDropRate = 0;
        for (let i = 1; i < stageMetrics.length; i++) {
          const drop = stageMetrics[i - 1].conversionRate - stageMetrics[i].conversionRate;
          if (drop > bottleneckDropRate) {
            bottleneckDropRate = drop;
            bottleneckStageId = stageMetrics[i].stageId;
          }
        }

        return {
          pipelineId: pipeline.id,
          pipelineName: pipeline.name,
          stages: stageMetrics,
          totalLeadsEntered,
          totalLeadsWon: wonLeads.length,
          totalLeadsLost: lostLeads.length,
          overallConversionRate,
          totalRevenue,
          avgSalesCycle,
          schedulingRate,
          appointmentShowRate,
          appointmentToWonRate,
          bottleneckStageId,
          bottleneckDropRate,
        };
      });

      return funnelMetrics;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const selectedFunnel = useMemo(() => {
    if (!query.data?.length) return null;
    if (pipelineId && pipelineId !== 'all') {
      return query.data.find(f => f.pipelineId === pipelineId) ?? query.data[0];
    }
    return query.data[0];
  }, [query.data, pipelineId]);

  return {
    funnelData: query.data ?? null,
    selectedFunnel,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
