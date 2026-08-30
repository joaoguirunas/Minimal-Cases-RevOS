import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDateFilter } from '@/hooks/bipro-date-utils';

export interface SchedulesFunnel {
  totalLeads: number;
  leadsComMeeting: number;
  meetingsRealizados: number;
  ganhosPosMeeting: number;
  leadToMeetingRate: number;
  meetingShowRate: number;
  showToWonRate: number;
}

export interface SchedulesKPIs {
  total: number;
  showRate: number;
  closingRate: number;
  noShows: number;
  remarcacoes: number;
}

export interface SchedulesByVendedor {
  userId: string;
  name: string;
  agendamentos: number;
  showRate: number;
  fechamentos: number;
  receitaGerada: number;
}

export interface SchedulesHeatmapPoint {
  weekday: number;
  hour: number;
  count: number;
}

export interface SchedulesEvolutionPoint {
  date: string;
  agendados: number;
  realizados: number;
  naoCompareceram: number;
  cancelados: number;
}

export interface SchedulesShowByWeekday {
  weekday: number;  // 0=Sun … 6=Sat
  total: number;
  showed: number;
  showRate: number;
}

export interface BIProSchedulesData {
  funnel: SchedulesFunnel;
  kpis: SchedulesKPIs;
  byVendedor: SchedulesByVendedor[];
  byHorario: SchedulesHeatmapPoint[];
  evolution: SchedulesEvolutionPoint[];
  leadToMeetingAvgDays: number | null;    // avg days: lead created → first meeting
  meetingToCloseAvgDays: number | null;   // avg days: meeting realized → lead won
  avgMeetingsPerDeal: number | null;      // avg meetings for won leads
  showRateByWeekday: SchedulesShowByWeekday[];
}

export interface UseBIProSchedulesOptions {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

type MeetingRow = {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  status: string | null;
  date: string | null;
  start_time: string | null;
  lead: { id: string; status: string | null; value: number | null; created_at: string; won_at: string | null } | null;
};

export function useBIProSchedules(options: UseBIProSchedulesOptions = {}) {
  const { period = 'all', dateFrom, dateTo, pipelineId, scoreFilter } = options;

  const dateFilter = useMemo(
    () => buildDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-schedules', period, dateFrom, dateTo, pipelineId, scoreFilter];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<BIProSchedulesData> => {
      // Meetings with lead info (+ pipeline/score filtering via lead join)
      let meetingsQ = supabase
        .from('meetings')
        .select('id, lead_id, user_id, status, date, start_time, lead:leads!meetings_leads_id_fkey(id, status, value, created_at, won_at, leads_stages(leads_pipelines_id))');

      if (dateFilter) {
        meetingsQ = meetingsQ
          .gte('date', dateFilter.from.split('T')[0])
          .lte('date', dateFilter.to.split('T')[0]);
      }

      // Total leads in period (for leadToMeetingRate denominator)
      let leadsCountQ = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true });

      if (dateFilter) {
        leadsCountQ = leadsCountQ
          .gte('created_at', dateFilter.from)
          .lte('created_at', dateFilter.to);
      }

      // Apply pipeline filter to leads count query
      if (pipelineId && pipelineId !== 'all') {
        leadsCountQ = leadsCountQ
          .select('id, leads_stages!inner(leads_pipelines_id)', { count: 'exact', head: true })
          .eq('leads_stages.leads_pipelines_id', pipelineId);
      }

      // Apply score filter to leads count query
      if (scoreFilter && scoreFilter.length > 0) {
        leadsCountQ = leadsCountQ
          .select('id, clients_people!inner(score)', { count: 'exact', head: true })
          .in('clients_people.score', scoreFilter);
      }

      // Settings users
      const usersQ = supabase.from('settings_users').select('id, name');

      // If scoreFilter is active, fetch lead IDs that match the score
      const scoreLeadIdsQ = scoreFilter && scoreFilter.length > 0
        ? supabase
            .from('clients_people')
            .select('leads!inner(id)')
            .in('score', scoreFilter)
        : Promise.resolve({ data: null });

      const [meetingsResult, leadsCountResult, usersResult, scoreLeadIdsResult] = await Promise.all([
        meetingsQ, leadsCountQ, usersQ, scoreLeadIdsQ,
      ]);
      const totalLeadsInPeriod: number = leadsCountResult.count ?? 0;

      let meetings: MeetingRow[] = meetingsResult.data ?? [];
      const users: Array<{ id: string; name: string }> = usersResult.data ?? [];
      const userMap = new Map(users.map(u => [u.id, u.name]));

      // Apply pipeline filter: keep only meetings whose lead belongs to the selected pipeline
      if (pipelineId && pipelineId !== 'all') {
        meetings = meetings.filter(m => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const leadObj = m.lead as Record<string, any> | null;
          const leadStages = leadObj?.leads_stages as { leads_pipelines_id?: string } | undefined;
          return leadStages?.leads_pipelines_id === pipelineId;
        });
      }

      // Apply score filter: keep only meetings whose lead matches the score
      if (scoreFilter && scoreFilter.length > 0 && scoreLeadIdsResult.data) {
        const allowedLeadIds = new Set(
          (scoreLeadIdsResult.data as Array<Record<string, unknown>>).flatMap((row) => {
            const leads = row.leads;
            if (Array.isArray(leads)) return leads.map((l: Record<string, unknown>) => l.id as string);
            if (leads && typeof leads === 'object' && 'id' in (leads as Record<string, unknown>)) return [(leads as Record<string, unknown>).id as string];
            return [];
          })
        );
        meetings = meetings.filter(m => m.lead_id && allowedLeadIds.has(m.lead_id));
      }

      const empty: BIProSchedulesData = {
        funnel: { totalLeads: 0, leadsComMeeting: 0, meetingsRealizados: 0, ganhosPosMeeting: 0, leadToMeetingRate: 0, meetingShowRate: 0, showToWonRate: 0 },
        kpis: { total: 0, showRate: 0, closingRate: 0, noShows: 0, remarcacoes: 0 },
        byVendedor: [],
        byHorario: [],
        evolution: [],
        leadToMeetingAvgDays: null,
        meetingToCloseAvgDays: null,
        avgMeetingsPerDeal: null,
        showRateByWeekday: Array.from({ length: 7 }, (_, i) => ({ weekday: i, total: 0, showed: 0, showRate: 0 })),
      };

      if (meetings.length === 0) return empty;

      // Status groups
      const agendados = meetings.filter(m => m.status === 'agendado');
      const realizados = meetings.filter(m => m.status === 'compareceu');
      const naoCompareceram = meetings.filter(m => m.status === 'nao_compareceu');
      const cancelados = meetings.filter(m => m.status === 'cancelado');

      // === FUNNEL ===
      const uniqueLeadIds = new Set(meetings.map(m => m.lead_id).filter(Boolean));
      const leadsComMeeting = uniqueLeadIds.size;
      const realizadosCount = realizados.length;
      // Ganhos pós meeting: leads with status=won that had a meeting
      const wonLeadIds = new Set(
        meetings.filter(m => m.lead?.status === 'won').map(m => m.lead_id).filter(Boolean)
      );
      const ganhosPosMeeting = wonLeadIds.size;

      // totalLeads comes from dedicated count query — avoids the 100% bug
      // where totalLeads === leadsWithMeeting (both from the same meetings set)
      const totalLeads = totalLeadsInPeriod > 0 ? totalLeadsInPeriod : leadsComMeeting;

      const funnel: SchedulesFunnel = {
        totalLeads,
        leadsComMeeting,
        meetingsRealizados: realizadosCount,
        ganhosPosMeeting,
        leadToMeetingRate: totalLeads > 0 ? (leadsComMeeting / totalLeads) * 100 : 0,
        meetingShowRate: meetings.length > 0 ? (realizadosCount / meetings.length) * 100 : 0,
        showToWonRate: realizadosCount > 0 ? (ganhosPosMeeting / realizadosCount) * 100 : 0,
      };

      // === KPIs ===
      // Remarcações: leads with 2+ meetings in period
      const meetingCountByLead = new Map<string, number>();
      for (const m of meetings) {
        if (!m.lead_id) continue;
        meetingCountByLead.set(m.lead_id, (meetingCountByLead.get(m.lead_id) ?? 0) + 1);
      }
      const remarcacoes = [...meetingCountByLead.values()].filter(c => c >= 2).length;

      const kpis: SchedulesKPIs = {
        total: meetings.length,
        showRate: meetings.length > 0 ? (realizadosCount / meetings.length) * 100 : 0,
        closingRate: realizadosCount > 0 ? (ganhosPosMeeting / realizadosCount) * 100 : 0,
        noShows: naoCompareceram.length,
        remarcacoes,
      };

      // === BY VENDEDOR ===
      const vendedorMap = new Map<string, { agendamentos: number; realizados: number; fechamentos: number; receita: number }>();
      for (const m of meetings) {
        const userId = m.user_id ?? 'sem-usuario';
        if (!vendedorMap.has(userId)) {
          vendedorMap.set(userId, { agendamentos: 0, realizados: 0, fechamentos: 0, receita: 0 });
        }
        const v = vendedorMap.get(userId)!;
        v.agendamentos++;
        if (m.status === 'compareceu') v.realizados++;
        if (m.lead?.status === 'won') {
          v.fechamentos++;
          v.receita += Number(m.lead?.value) || 0;
        }
      }

      const byVendedor: SchedulesByVendedor[] = [...vendedorMap.entries()].map(([userId, d]) => ({
        userId,
        name: userMap.get(userId) ?? (userId === 'sem-usuario' ? 'Sem responsável' : userId),
        agendamentos: d.agendamentos,
        showRate: d.agendamentos > 0 ? (d.realizados / d.agendamentos) * 100 : 0,
        fechamentos: d.fechamentos,
        receitaGerada: d.receita,
      })).sort((a, b) => b.agendamentos - a.agendamentos);

      // === HEATMAP by weekday × hour ===
      const heatmapMap = new Map<string, number>();
      for (const m of meetings) {
        if (!m.date) continue;
        const d = new Date(m.date);
        const weekday = d.getDay(); // 0=Sun, 6=Sat
        const timeStr = m.start_time ?? '00:00';
        const hour = parseInt(timeStr.split(':')[0], 10);
        const key = `${weekday}-${hour}`;
        heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1);
      }

      const byHorario: SchedulesHeatmapPoint[] = [...heatmapMap.entries()].map(([key, count]) => {
        const [wd, hr] = key.split('-').map(Number);
        return { weekday: wd, hour: hr, count };
      });

      // === EVOLUTION ===
      const evoMap = new Map<string, SchedulesEvolutionPoint>();
      for (const m of meetings) {
        const dateKey = m.date ?? '';
        if (!dateKey) continue;
        if (!evoMap.has(dateKey)) {
          evoMap.set(dateKey, { date: dateKey, agendados: 0, realizados: 0, naoCompareceram: 0, cancelados: 0 });
        }
        const e = evoMap.get(dateKey)!;
        if (m.status === 'agendado') e.agendados++;
        else if (m.status === 'compareceu') e.realizados++;
        else if (m.status === 'nao_compareceu') e.naoCompareceram++;
        else if (m.status === 'cancelado') e.cancelados++;
      }
      const evolution = [...evoMap.values()].sort((a, b) => a.date.localeCompare(b.date));

      // === LEAD → REUNIÃO (avg days from lead created to first meeting) ===
      const firstMeetingByLead = new Map<string, string>(); // leadId → earliest date
      for (const m of meetings) {
        if (!m.lead_id || !m.date) continue;
        const existing = firstMeetingByLead.get(m.lead_id);
        if (!existing || m.date < existing) firstMeetingByLead.set(m.lead_id, m.date);
      }
      const leadToMeetingDays: number[] = [];
      for (const [leadId, meetingDate] of firstMeetingByLead.entries()) {
        const leadCreated = meetings.find(m => m.lead_id === leadId)?.lead?.created_at;
        if (!leadCreated) continue;
        const days = (new Date(meetingDate).getTime() - new Date(leadCreated).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) leadToMeetingDays.push(days);
      }
      const leadToMeetingAvgDays = leadToMeetingDays.length > 0
        ? leadToMeetingDays.reduce((a, b) => a + b, 0) / leadToMeetingDays.length
        : null;

      // === REUNIÃO → FECHAMENTO (avg days from realized meeting to won_at) ===
      const meetingToCloseDaysList: number[] = [];
      for (const m of realizados) {
        const wonAt = m.lead?.won_at;
        if (!m.date || !wonAt) continue;
        const days = (new Date(wonAt).getTime() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) meetingToCloseDaysList.push(days);
      }
      const meetingToCloseAvgDays = meetingToCloseDaysList.length > 0
        ? meetingToCloseDaysList.reduce((a, b) => a + b, 0) / meetingToCloseDaysList.length
        : null;

      // === AVG MEETINGS PER WON DEAL ===
      const wonLeadIdsForAvg = new Set(meetings.filter(m => m.lead?.status === 'won').map(m => m.lead_id).filter(Boolean));
      const meetingsPerWon: number[] = [];
      for (const lid of wonLeadIdsForAvg) {
        const count = meetings.filter(m => m.lead_id === lid).length;
        if (count > 0) meetingsPerWon.push(count);
      }
      const avgMeetingsPerDeal = meetingsPerWon.length > 0
        ? meetingsPerWon.reduce((a, b) => a + b, 0) / meetingsPerWon.length
        : null;

      // === SHOW RATE BY WEEKDAY ===
      const weekdayMap = new Map<number, { total: number; showed: number }>();
      for (let i = 0; i <= 6; i++) weekdayMap.set(i, { total: 0, showed: 0 });
      for (const m of meetings) {
        if (!m.date) continue;
        const wd = new Date(m.date).getDay();
        const entry = weekdayMap.get(wd)!;
        entry.total++;
        if (m.status === 'compareceu') entry.showed++;
      }
      const showRateByWeekday: SchedulesShowByWeekday[] = [...weekdayMap.entries()]
        .map(([weekday, d]) => ({
          weekday,
          total: d.total,
          showed: d.showed,
          showRate: d.total > 0 ? (d.showed / d.total) * 100 : 0,
        }));

      return {
        funnel, kpis, byVendedor, byHorario, evolution,
        leadToMeetingAvgDays, meetingToCloseAvgDays, avgMeetingsPerDeal, showRateByWeekday,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
