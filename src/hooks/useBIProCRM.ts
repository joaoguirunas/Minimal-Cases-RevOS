import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveChannel } from '@/hooks/useBIProAttribution';
import { buildDateFilter, buildPrevDateFilter } from '@/hooks/bipro-date-utils';

// Re-export for backward compatibility (useBIProRevOps, BIProComercialTab)
export { buildDateFilter } from '@/hooks/bipro-date-utils';

export interface BIProCRMKPIs {
  receita: number;
  ticketMedio: number;
  projecao: number;
  pipelineVelocity: number | null;   // leads × conv% × ticketMedio / ciclo × 30 = monthly revenue velocity
  cac: number | null;
  roi: number | null;
  cicloMedioVenda: number | null;
  totalLeads: number;
  totalGanhos: number;
  totalPerdidos: number;
  taxaConversao: number;
  pipelineValue: number;
  totalSpend: number;
  attributionCoverage: number;       // % of leads with UTM/attribution data
}

export interface BIProCRMFunnelStage {
  stageId: string;
  stageName: string;
  stageOrder: number;
  stageColor: string | null;
  leads: number;
  convertidos: number;
  perdidos: number;
  taxaConversao: number;
  avgDiasNoStage: number;
  valorTotal: number;
  dropRate: number; // % that drop vs previous stage
}

export interface BIProCRMByVendedor {
  userId: string;
  user: string;
  leads: number;
  perdidos: number;
  ganhos: number;
  taxaConv: number;
  receita: number;
  ticketMedio: number;
  cicloMedio: number | null;
  meetings: number;
}

export interface BIProCRMByChannel {
  channel: string;
  platform: string;
  totalLeads: number;
  wonLeads: number;
  revenue: number;
  avgDeal: number;
  conversionRate: number;
  totalAdSpend: number;
  cac: number | null;
  cpl: number | null;
  roi: number | null;
  meetings: number;
  shownMeetings: number;
  showRate: number;
  costPerMeeting: number | null;
}

export interface BIProCRMByCampaign {
  campaignName: string;
  platform: string;
  totalLeads: number;
  cpl: number | null;
  meetings: number;
  shownMeetings: number;
  showRate: number;
  costPerMeeting: number | null;
  wonLeads: number;
  avgDeal: number;
  cac: number | null;
  revenue: number;
  roi: number | null;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface BIProCRMEvolutionPoint {
  date: string;
  leads: number;
  ganhos: number;
  receita: number;
}

export interface BIProCRMDeltas {
  totalLeads: number | null;
  totalGanhos: number | null;
  totalPerdidos: number | null;
  taxaConversao: number | null;
  receita: number | null;
  ticketMedio: number | null;
  cicloMedioVenda: number | null;
}

export interface BIProCRMData {
  kpis: BIProCRMKPIs;
  kpiDeltas: BIProCRMDeltas;
  funnel: BIProCRMFunnelStage[];
  byVendedor: BIProCRMByVendedor[];
  byChannel: BIProCRMByChannel[];
  byCampaign: BIProCRMByCampaign[];
  evolution: BIProCRMEvolutionPoint[];
  totalSpend: number;
  totalRevenue: number;
  overallCAC: number | null;
  overallROI: number | null;
  attributionCoverage: number;
}

export interface UseBIProCRMOptions {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

function pctDelta(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

type LeadRow = {
  id: string;
  value: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  won_at: string | null;
  user_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fbclid: string | null;
  gclid: string | null;
  leads_stages_id: string | null;
  leads_stages: { id: string; name: string; order_index: number; color: string | null; leads_pipelines_id: string } | null;
};

type SpendRow = {
  spend: number;
  impressions: number | null;
  clicks: number | null;
  platform: string;
  campaign_id: string | null;
  date: string;
};

type MeetingRow = {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  status: string | null;
};

export function useBIProCRM(options: UseBIProCRMOptions = {}) {
  const { period = 'all', dateFrom, dateTo, pipelineId, scoreFilter } = options;

  const dateFilter = useMemo(
    () => buildDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const prevDateFilter = useMemo(
    () => buildPrevDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-crm-v2', period, dateFrom, dateTo, pipelineId, scoreFilter];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<BIProCRMData> => {
      // Left join (no !inner) so lost/won leads with cleared stage are still included in KPI totals
      // Pipeline filter applied in JS post-fetch to preserve all lost leads
       
      let leadsQ = supabase
        .from('leads')
        .select('id, value, status, created_at, updated_at, won_at, user_id, utm_source, utm_medium, utm_campaign, fbclid, gclid, leads_stages_id, leads_stages(id, name, order_index, color, leads_pipelines_id)');

      if (scoreFilter && scoreFilter.length > 0) {
        leadsQ = leadsQ
          .select('id, value, status, created_at, updated_at, won_at, user_id, utm_source, utm_medium, utm_campaign, fbclid, gclid, leads_stages_id, leads_stages(id, name, order_index, color, leads_pipelines_id), clients_people!inner(score)')
          .in('clients_people.score', scoreFilter);
      }
      if (dateFilter) {
        leadsQ = leadsQ.gte('created_at', dateFilter.from).lte('created_at', dateFilter.to);
      }

       
      let spendQ = supabase
        .from('bi_ad_spend')
        .select('spend, impressions, clicks, platform, campaign_id, date');
      if (dateFilter) {
        spendQ = spendQ
          .gte('date', dateFilter.from.split('T')[0])
          .lte('date', dateFilter.to.split('T')[0]);
      }

      // Fetch campaigns separately (avoids PostgREST FK cache dependency)
       
      const campaignsQ = supabase
        .from('bi_ad_campaigns')
        .select('id, campaign_name, utm_campaign, platform');

       
      let meetingsQ = supabase
        .from('meetings')
        .select('id, lead_id, user_id, status');
      if (dateFilter) {
        meetingsQ = meetingsQ.gte('created_at', dateFilter.from).lte('created_at', dateFilter.to);
      }

      const usersQ = supabase.from('settings_users').select('id, name');

      // Previous period leads (for delta computation) — minimal fields only
       
      let prevLeadsQ = supabase
        .from('leads')
        .select('value, status, won_at, created_at');
      if (prevDateFilter) {
        prevLeadsQ = prevLeadsQ.gte('created_at', prevDateFilter.from).lte('created_at', prevDateFilter.to);
      } else {
        prevLeadsQ = prevLeadsQ.limit(0); // no filter = no prev comparison
      }

      const [leadsResult, spendResult, meetingsResult, usersResult, prevLeadsResult, campaignsResult] = await Promise.all([
        leadsQ, spendQ, meetingsQ, usersQ, prevLeadsQ, campaignsQ,
      ]);

      const allLeads: LeadRow[] = leadsResult.data ?? [];
      // Apply pipeline filter in JS — includes lost/won leads that lost their stage reference
      const leads: LeadRow[] = pipelineId && pipelineId !== 'all'
        ? allLeads.filter(l => l.leads_stages?.leads_pipelines_id === pipelineId)
        : allLeads;
      const spendRows: SpendRow[] = spendResult.data ?? [];

      // Build campaign lookup: bi_ad_campaigns.id → { campaign_name, utm_campaign }
      type CampaignMeta = { campaign_name: string; utm_campaign: string | null; platform: string };
      const campaignMetaMap = new Map<string, CampaignMeta>();
      for (const c of (campaignsResult.data ?? []) as Array<{ id: string; campaign_name: string; utm_campaign: string | null; platform: string }>) {
        campaignMetaMap.set(c.id, { campaign_name: c.campaign_name, utm_campaign: c.utm_campaign, platform: c.platform });
      }
      const meetings: MeetingRow[] = meetingsResult.data ?? [];
      const users: Array<{ id: string; name: string }> = usersResult.data ?? [];
      const userMap = new Map(users.map(u => [u.id, u.name]));
      const prevLeads: Array<{ value: number | null; status: string | null; won_at: string | null; created_at: string | null }> = prevLeadsResult.data ?? [];

      // Meetings by lead (total + shown)
      const meetingsByLead = new Map<string, number>();
      const shownMeetingsByLead = new Map<string, number>();
      for (const m of meetings) {
        if (!m.lead_id) continue;
        meetingsByLead.set(m.lead_id, (meetingsByLead.get(m.lead_id) ?? 0) + 1);
        if (m.status === 'compareceu') {
          shownMeetingsByLead.set(m.lead_id, (shownMeetingsByLead.get(m.lead_id) ?? 0) + 1);
        }
      }

      // === KPIs ===
      const wonLeads = leads.filter(l => l.status === 'won');
      const lostLeads = leads.filter(l => l.status === 'lost');
      const activeLeads = leads.filter(l => l.status !== 'won' && l.status !== 'lost');
      const totalRevenue = wonLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      const ticketMedio = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;
      const avgCloseRate = leads.length > 0 ? wonLeads.length / leads.length : 0;
      const pipelineValue = activeLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      const projecao = pipelineValue * avgCloseRate;
      const taxaConversao = leads.length > 0 ? (wonLeads.length / leads.length) * 100 : 0;

      // Sales cycle using won_at if available, else updated_at
      const salesCyclesDays = wonLeads
        .map(l => {
          const closeTime = l.won_at ? new Date(l.won_at).getTime() : new Date(l.updated_at ?? '').getTime();
          return (closeTime - new Date(l.created_at ?? '').getTime()) / (1000 * 60 * 60 * 24);
        })
        .filter(d => d > 0 && d < 3650);
      const cicloMedioVenda = salesCyclesDays.length > 0
        ? salesCyclesDays.reduce((a, b) => a + b, 0) / salesCyclesDays.length
        : null;

      const spendByPlatform = new Map<string, number>();
      for (const row of spendRows) {
        spendByPlatform.set(row.platform, (spendByPlatform.get(row.platform) ?? 0) + (Number(row.spend) || 0));
      }
      const totalSpend = [...spendByPlatform.values()].reduce((a, b) => a + b, 0);
      const cac = totalSpend > 0 && wonLeads.length > 0 ? totalSpend / wonLeads.length : null;
      const roi = totalSpend > 0 && totalRevenue > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null;

      // === FUNNEL (by stage, pipeline-aware) ===
      const stageMap = new Map<string, {
        name: string;
        order: number;
        color: string | null;
        leads: LeadRow[];
      }>();
      for (const lead of leads) {
        if (!lead.leads_stages) continue;
        const s = lead.leads_stages;
        if (!stageMap.has(s.id)) stageMap.set(s.id, { name: s.name, order: s.order_index, color: s.color, leads: [] });
        stageMap.get(s.id)!.leads.push(lead);
      }
      const sortedStages = [...stageMap.entries()].sort((a, b) => a[1].order - b[1].order);

      const funnel: BIProCRMFunnelStage[] = sortedStages.map(([stageId, stage], idx) => {
        const stageLeads = stage.leads;
        const convertidos = stageLeads.filter(l => l.status === 'won').length;
        const perdidos = stageLeads.filter(l => l.status === 'lost').length;
        const taxaConv = stageLeads.length > 0 ? (convertidos / stageLeads.length) * 100 : 0;
        const avgDiasNoStage = stageLeads.length > 0
          ? stageLeads.reduce((sum, l) => {
              const days = (new Date(l.updated_at ?? '').getTime() - new Date(l.created_at ?? '').getTime()) / (1000 * 60 * 60 * 24);
              return sum + Math.max(0, Math.min(days, 365));
            }, 0) / stageLeads.length
          : 0;
        const valorTotal = stageLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        // Drop rate vs previous stage
        const prevStageLeads = idx > 0 ? sortedStages[idx - 1][1].leads.length : stageLeads.length;
        const dropRate = prevStageLeads > 0
          ? Math.max(0, ((prevStageLeads - stageLeads.length) / prevStageLeads) * 100)
          : 0;
        return {
          stageId, stageName: stage.name, stageOrder: stage.order, stageColor: stage.color,
          leads: stageLeads.length, convertidos, perdidos, taxaConversao: taxaConv,
          avgDiasNoStage, valorTotal, dropRate,
        };
      });

      // === BY VENDEDOR ===
      const vendedorMap = new Map<string, {
        leads: LeadRow[]; won: LeadRow[]; lost: LeadRow[];
        revenue: number; salesCycles: number[]; meetings: number;
      }>();
      for (const lead of leads) {
        const uid = lead.user_id ?? '__none__';
        if (!vendedorMap.has(uid)) vendedorMap.set(uid, { leads: [], won: [], lost: [], revenue: 0, salesCycles: [], meetings: 0 });
        const v = vendedorMap.get(uid)!;
        v.leads.push(lead);
        v.meetings += meetingsByLead.get(lead.id) ?? 0;
        if (lead.status === 'won') {
          v.won.push(lead);
          v.revenue += Number(lead.value) || 0;
          const closeTime = lead.won_at ? new Date(lead.won_at).getTime() : new Date(lead.updated_at ?? '').getTime();
          const d = (closeTime - new Date(lead.created_at ?? '').getTime()) / (1000 * 60 * 60 * 24);
          if (d > 0 && d < 3650) v.salesCycles.push(d);
        }
        if (lead.status === 'lost') v.lost.push(lead);
      }

      const byVendedor: BIProCRMByVendedor[] = [...vendedorMap.entries()].map(([uid, d]) => ({
        userId: uid,
        user: userMap.get(uid) ?? (uid === '__none__' ? 'Sem responsável' : uid.slice(0, 8)),
        leads: d.leads.length,
        perdidos: d.lost.length,
        ganhos: d.won.length,
        taxaConv: d.leads.length > 0 ? (d.won.length / d.leads.length) * 100 : 0,
        receita: d.revenue,
        ticketMedio: d.won.length > 0 ? d.revenue / d.won.length : 0,
        cicloMedio: d.salesCycles.length > 0 ? d.salesCycles.reduce((a, b) => a + b) / d.salesCycles.length : null,
        meetings: d.meetings,
      })).sort((a, b) => b.receita - a.receita);

      // === BY CHANNEL ===
      const channelMap = new Map<string, { platform: string; leads: LeadRow[] }>();
      for (const lead of leads) {
        const { channel, platform } = resolveChannel(lead);
        if (!channelMap.has(channel)) channelMap.set(channel, { platform, leads: [] });
        channelMap.get(channel)!.leads.push(lead);
      }

      const byChannel: BIProCRMByChannel[] = [...channelMap.entries()].map(([channel, { platform, leads: chl }]) => {
        const won = chl.filter(l => l.status === 'won');
        const revenue = won.reduce((s, l) => s + (Number(l.value) || 0), 0);
        const spend = spendByPlatform.get(platform) ?? 0;
        const chlMeetings = chl.reduce((sum, l) => sum + (meetingsByLead.get(l.id) ?? 0), 0);
        const chlShown = chl.reduce((sum, l) => sum + (shownMeetingsByLead.get(l.id) ?? 0), 0);
        return {
          channel, platform,
          totalLeads: chl.length,
          wonLeads: won.length,
          revenue,
          avgDeal: won.length > 0 ? revenue / won.length : 0,
          conversionRate: chl.length > 0 ? (won.length / chl.length) * 100 : 0,
          totalAdSpend: spend,
          cac: spend > 0 && won.length > 0 ? spend / won.length : null,
          cpl: spend > 0 && chl.length > 0 ? spend / chl.length : null,
          roi: spend > 0 && revenue > 0 ? ((revenue - spend) / spend) * 100 : null,
          meetings: chlMeetings,
          shownMeetings: chlShown,
          showRate: chlMeetings > 0 ? (chlShown / chlMeetings) * 100 : 0,
          costPerMeeting: spend > 0 && chlMeetings > 0 ? spend / chlMeetings : null,
        };
      }).sort((a, b) => b.totalLeads - a.totalLeads);

      // === BY CAMPAIGN ===
      const campaignSpendMap = new Map<string, {
        name: string; platform: string; utm: string | null;
        spend: number; impressions: number; clicks: number;
      }>();
      for (const row of spendRows) {
        const key = row.campaign_id ?? `${row.platform}-default`;
        const meta = row.campaign_id ? campaignMetaMap.get(row.campaign_id) : undefined;
        const name = meta?.campaign_name ?? 'Sem campanha';
        const ex = campaignSpendMap.get(key);
        campaignSpendMap.set(key, {
          name, platform: row.platform,
          utm: meta?.utm_campaign ?? null,
          spend: (ex?.spend ?? 0) + (Number(row.spend) || 0),
          impressions: (ex?.impressions ?? 0) + (Number(row.impressions) || 0),
          clicks: (ex?.clicks ?? 0) + (Number(row.clicks) || 0),
        });
      }

      const byCampaign: BIProCRMByCampaign[] = [...campaignSpendMap.entries()].map(([, camp]) => {
        const campLeads = camp.utm
          ? leads.filter(l => l.utm_campaign === camp.utm)
          : leads.filter(l => resolveChannel(l).platform === camp.platform);
        const won = campLeads.filter(l => l.status === 'won');
        const revenue = won.reduce((s, l) => s + (Number(l.value) || 0), 0);
        const campMeetings = campLeads.reduce((sum, l) => sum + (meetingsByLead.get(l.id) ?? 0), 0);
        const campShown = campLeads.reduce((sum, l) => sum + (shownMeetingsByLead.get(l.id) ?? 0), 0);
        const cpl = camp.spend > 0 && campLeads.length > 0 ? camp.spend / campLeads.length : null;
        const cac = camp.spend > 0 && won.length > 0 ? camp.spend / won.length : null;
        const costPerMeeting = camp.spend > 0 && campMeetings > 0 ? camp.spend / campMeetings : null;
        const roi = camp.spend > 0 && revenue > 0 ? ((revenue - camp.spend) / camp.spend) * 100 : null;
        return {
          campaignName: camp.name, platform: camp.platform,
          totalLeads: campLeads.length, cpl,
          meetings: campMeetings, shownMeetings: campShown,
          showRate: campMeetings > 0 ? (campShown / campMeetings) * 100 : 0,
          costPerMeeting,
          wonLeads: won.length, avgDeal: won.length > 0 ? revenue / won.length : 0,
          cac, revenue, roi, spend: camp.spend,
          impressions: camp.impressions, clicks: camp.clicks,
        };
      }).sort((a, b) => b.spend - a.spend);

      // === EVOLUTION (leads by created_at, revenue/ganhos by won_at) ===
      const evoLeadMap = new Map<string, number>();
      for (const lead of leads) {
        const raw = lead.created_at?.split('T')[0] ?? '';
        if (!raw) continue;
        evoLeadMap.set(raw, (evoLeadMap.get(raw) ?? 0) + 1);
      }

      const evoWonMap = new Map<string, { ganhos: number; receita: number }>();
      for (const lead of leads) {
        if (lead.status !== 'won') continue;
        // Use won_at if available, fallback to updated_at
        const raw = lead.won_at?.split('T')[0] ?? lead.updated_at?.split('T')[0] ?? '';
        if (!raw) continue;
        if (!evoWonMap.has(raw)) evoWonMap.set(raw, { ganhos: 0, receita: 0 });
        const e = evoWonMap.get(raw)!;
        e.ganhos++;
        e.receita += Number(lead.value) || 0;
      }

      // Merge both maps into unified evolution points
      const allEvoKeys = new Set([...evoLeadMap.keys(), ...evoWonMap.keys()]);
      const evolution: BIProCRMEvolutionPoint[] = [...allEvoKeys]
        .map(date => ({
          date,
          leads: evoLeadMap.get(date) ?? 0,
          ganhos: evoWonMap.get(date)?.ganhos ?? 0,
          receita: evoWonMap.get(date)?.receita ?? 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const trackedLeads = leads.filter(l => l.utm_source || l.fbclid || l.gclid || l.utm_campaign || l.utm_medium);
      const attributionCoverage = leads.length > 0 ? (trackedLeads.length / leads.length) * 100 : 0;

      // === PREVIOUS PERIOD DELTAS ===
      const hasPrev = prevLeads.length > 0 || prevDateFilter !== null;
      const prevWon = prevLeads.filter(l => l.status === 'won');
      const prevLost = prevLeads.filter(l => l.status === 'lost');
      const prevRevenue = prevWon.reduce((s, l) => s + (Number(l.value) || 0), 0);
      const prevTicket = prevWon.length > 0 ? prevRevenue / prevWon.length : 0;
      const prevTaxaConv = prevLeads.length > 0 ? (prevWon.length / prevLeads.length) * 100 : 0;
      const prevSalesCycles = prevWon
        .map(l => {
          const closeTime = l.won_at ? new Date(l.won_at).getTime() : 0;
          if (!closeTime || !l.created_at) return null;
          const d = (closeTime - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return d > 0 && d < 3650 ? d : null;
        })
        .filter((d): d is number => d !== null);
      const prevCiclo = prevSalesCycles.length > 0
        ? prevSalesCycles.reduce((a, b) => a + b, 0) / prevSalesCycles.length
        : null;

      const kpiDeltas: BIProCRMDeltas = !hasPrev ? {
        totalLeads: null, totalGanhos: null, totalPerdidos: null, taxaConversao: null,
        receita: null, ticketMedio: null, cicloMedioVenda: null,
      } : {
        totalLeads: pctDelta(leads.length, prevLeads.length),
        totalGanhos: pctDelta(wonLeads.length, prevWon.length),
        totalPerdidos: pctDelta(lostLeads.length, prevLost.length),
        taxaConversao: pctDelta(taxaConversao, prevTaxaConv),
        receita: pctDelta(totalRevenue, prevRevenue),
        ticketMedio: pctDelta(ticketMedio, prevTicket),
        cicloMedioVenda: cicloMedioVenda !== null && prevCiclo !== null
          ? pctDelta(cicloMedioVenda, prevCiclo)
          : null,
      };

      // Pipeline Velocity: projected monthly revenue from the active pipeline
      // Formula: (activeLeads × convRate × ticketMedio) / cicloMedio × 30
      const pipelineVelocity =
        cicloMedioVenda !== null && cicloMedioVenda > 0 && ticketMedio > 0
          ? (activeLeads.length * (taxaConversao / 100) * ticketMedio) / cicloMedioVenda * 30
          : null;

      return {
        kpis: {
          receita: totalRevenue, ticketMedio, projecao, pipelineVelocity, cac, roi, cicloMedioVenda,
          totalLeads: leads.length, totalGanhos: wonLeads.length, totalPerdidos: lostLeads.length,
          taxaConversao, pipelineValue, totalSpend, attributionCoverage,
        },
        kpiDeltas,
        funnel, byVendedor, byChannel, byCampaign, evolution,
        totalSpend, totalRevenue,
        overallCAC: totalSpend > 0 && wonLeads.length > 0 ? totalSpend / wonLeads.length : null,
        overallROI: totalSpend > 0 && totalRevenue > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null,
        attributionCoverage,
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
