import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDateFilter, buildPrevDateFilter } from '@/hooks/bipro-date-utils';

export interface BIProKPIs {
  // Receita
  totalRevenue: number;
  revenueGrowth: number;
  projectedRevenue: number;
  avgDealValue: number;

  // Volume
  totalLeads: number;
  newLeads: number;
  activeLeads: number;
  wonLeads: number;
  lostLeads: number;

  // Conversão
  overallConversionRate: number;
  leadToMeetingRate: number;
  meetingToWonRate: number;

  // Custos (null se Ads não configurado)
  totalAdSpend: number | null;
  estimatedCAC: number | null;
  revenuePerLead: number | null;

  // Scores (null se SCORE PRO não configurado)
  avgLeadScore: number | null;
  highScoreLeads: number | null;

  // Performance
  avgSalesCycle: number | null;
  avgResponseTime: number | null;

  // Período
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
}

export interface UseBIProKPIsOptions {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  includeAds?: boolean;
  scoreFilter?: number[];
}

const PERIOD_LABELS: Record<string, string> = {
  today: 'Hoje',
  week: 'Esta semana',
  'last-week': 'Semana passada',
  month: 'Mês atual',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 3 meses',
  '1y': 'Último ano',
};

function buildPeriodDates(period: string, dateFrom?: string, dateTo?: string) {
  if (dateFrom && dateTo) {
    return {
      current: { from: dateFrom, to: dateTo },
      previous: null,
      label: 'Período personalizado',
    };
  }

  const current = buildDateFilter(period, dateFrom, dateTo);
  const previous = buildPrevDateFilter(period, dateFrom, dateTo);
  const label = PERIOD_LABELS[period] ?? 'Todo o período';

  return { current, previous, label };
}

export function useBIProKPIs(options: UseBIProKPIsOptions = {}) {
  const { period = 'all', dateFrom, dateTo, pipelineId, includeAds = true, scoreFilter } = options;

  const periodDates = useMemo(
    () => buildPeriodDates(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-kpis', period, dateFrom, dateTo, pipelineId, includeAds, scoreFilter];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<BIProKPIs> => {
      // Build base leads query
      const buildLeadsQuery = (dateRange: { from: string; to: string } | null) => {
        let q = supabase
          .from('leads')
          .select('id, value, status, created_at, updated_at, won_at, leads_stages_id, leads_stages!inner(leads_pipelines_id)');

        if (pipelineId && pipelineId !== 'all') {
          q = q.eq('leads_stages.leads_pipelines_id', pipelineId);
        }
        if (scoreFilter && scoreFilter.length > 0) {
          q = q
            .select('id, value, status, created_at, updated_at, won_at, leads_stages_id, leads_stages!inner(leads_pipelines_id), clients_people!inner(score)')
            .in('clients_people.score', scoreFilter);
        }
        if (dateRange) {
          q = q.gte('created_at', dateRange.from).lte('created_at', dateRange.to);
        }
        return q;
      };

      // Run all queries in parallel
      const [leadsResult, prevLeadsResult, meetingsResult, adSpendResult] = await Promise.all([
        buildLeadsQuery(periodDates.current),
        periodDates.previous ? buildLeadsQuery(periodDates.previous) : Promise.resolve({ data: null }),
        supabase.from('meetings').select('id, lead_id, status'),
        includeAds
          ? (() => {
               
              let q = supabase.from('bi_ad_spend').select('spend, date');
              if (periodDates.current) {
                q = q
                  .gte('date', periodDates.current.from.split('T')[0])
                  .lte('date', periodDates.current.to.split('T')[0]);
              }
              return q;
            })()
          : Promise.resolve({ data: null }),
      ]);

      const leads = leadsResult.data || [];
      const prevLeads = prevLeadsResult.data || [];
      const meetings = meetingsResult.data || [];
      const adSpend = adSpendResult.data;

      // Leads metrics
      const wonLeads = leads.filter(l => l.status === 'won');
      const lostLeads = leads.filter(l => l.status === 'lost');
      const activeLeads = leads.filter(l => l.status === 'in_progress' || !l.status);

      const totalRevenue = wonLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      const avgDealValue = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;

      // Previous period revenue for growth calculation
      const prevWonLeads = prevLeads.filter(l => l.status === 'won');
      const prevRevenue = prevWonLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      const revenueGrowth = prevRevenue > 0
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
        : 0;

      // Projected revenue: active leads × historical conversion rate
      const historicalConversionRate = leads.length > 0 ? wonLeads.length / leads.length : 0;
      const activeTotalValue = activeLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      const projectedRevenue = activeTotalValue * historicalConversionRate;

      // Conversion rates
      const overallConversionRate = leads.length > 0
        ? (wonLeads.length / leads.length) * 100
        : 0;

      const leadIds = new Set(leads.map(l => l.id));
      const leadsWithMeeting = new Set(meetings.filter(m => leadIds.has(m.lead_id)).map(m => m.lead_id));
      const leadToMeetingRate = leads.length > 0
        ? (leadsWithMeeting.size / leads.length) * 100
        : 0;

      const wonLeadIds = new Set(wonLeads.map(l => l.id));
      const meetingsWithWon = meetings.filter(m => wonLeadIds.has(m.lead_id));
      const meetingToWonRate = meetings.length > 0
        ? (meetingsWithWon.length / meetings.length) * 100
        : 0;

      // Avg sales cycle: use won_at if available, fallback to updated_at
      const salesCycles = wonLeads.map(l => {
        const closed = l.won_at ? new Date(l.won_at).getTime() : new Date(l.updated_at).getTime();
        const days = (closed - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, days);
      });
      const avgSalesCycle = salesCycles.length > 0
        ? salesCycles.reduce((a, b) => a + b, 0) / salesCycles.length
        : null;

      // Ad spend & CAC
      let totalAdSpend: number | null = null;
      let estimatedCAC: number | null = null;
      let revenuePerLead: number | null = null;

      if (adSpend !== null) {
        const spendTotal = adSpend.reduce((sum, s) => sum + (Number(s.spend) || 0), 0);
        if (spendTotal > 0) {
          totalAdSpend = spendTotal;
          estimatedCAC = wonLeads.length > 0 ? spendTotal / wonLeads.length : null;
          revenuePerLead = leads.length > 0 ? totalRevenue / leads.length : null;
        }
      }

      const now = new Date();
      const resolvedDateFrom = periodDates.current?.from ?? '—';
      const resolvedDateTo = periodDates.current?.to ?? now.toISOString();

      return {
        totalRevenue,
        revenueGrowth,
        projectedRevenue,
        avgDealValue,
        totalLeads: leads.length,
        newLeads: leads.filter(l => {
          if (!periodDates.current) return true;
          return new Date(l.created_at) >= new Date(periodDates.current.from);
        }).length,
        activeLeads: activeLeads.length,
        wonLeads: wonLeads.length,
        lostLeads: lostLeads.length,
        overallConversionRate,
        leadToMeetingRate,
        meetingToWonRate,
        totalAdSpend,
        estimatedCAC,
        revenuePerLead,
        avgLeadScore: null,
        highScoreLeads: null,
        avgSalesCycle,
        avgResponseTime: null,
        periodLabel: periodDates.label,
        dateFrom: resolvedDateFrom,
        dateTo: resolvedDateTo,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    kpis: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
