import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDateFilter } from '@/hooks/bipro-date-utils';

export interface ChannelAttribution {
  channel: string;          // utm_source ou 'meta' | 'google' | 'organic' | 'direct'
  platform: 'meta' | 'google' | 'organic' | 'direct' | string;
  totalLeads: number;
  wonLeads: number;
  revenue: number;
  conversionRate: number;
  totalAdSpend: number;     // 0 se orgânico/direto
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpm: number | null;
  costPerLead: number | null;
  cac: number | null;       // null se sem spend
  roi: number | null;       // (revenue - spend) / spend × 100
  revenuePerLead: number;
  avgDealValue: number;
}

export interface CampaignAttribution {
  campaignName: string;
  platform: 'meta' | 'google';
  utmCampaign: string | null;
  totalLeads: number;
  wonLeads: number;
  revenue: number;
  conversionRate: number;
  totalAdSpend: number;
  cac: number | null;
  roi: number | null;
  costPerLead: number | null;
  impressions: number;
  clicks: number;
  ctr: number | null;        // clicks / impressions × 100
  cpm: number | null;        // (spend / impressions) × 1000
  platformLeads: number;     // leads reportados pela plataforma (Meta/Google API)
}

export interface FormProAttribution {
  formId: string;
  formName: string;
  totalLeads: number;
  wonLeads: number;
  revenue: number;
  conversionRate: number;
}

export interface TimeSeriesPoint {
  label: string;
  date: string;           // ISO date for sorting
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
}

export type TimeGranularity = 'day' | 'week' | 'month';

export interface AttributionData {
  byChannel: ChannelAttribution[];
  byCampaign: CampaignAttribution[];
  totalPeriodLeads: number;     // lead count real (únicos, filtrados por período)
  totalTrackedSpend: number;
  totalImpressions: number;
  totalClicks: number;
  overallCTR: number | null;    // clicks / impressions × 100
  overallCPM: number | null;    // (spend / impressions) × 1000
  totalRevenue: number;
  overallCAC: number | null;
  overallROI: number | null;
  attributionCoverage: number;  // % de leads com UTM/click ID rastreados
  timeSeries: TimeSeriesPoint[];
  timeGranularity: TimeGranularity;
  formPro: {
    totalLeads: number;
    wonLeads: number;
    revenue: number;
    byForm: FormProAttribution[];
  };
}

export interface UseBIProAttributionOptions {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

export function resolveChannel(lead: {
  utm_source?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  utm_medium?: string | null;
  fb_lead_id?: string | null;
  _isMetaLeadAd?: boolean;
}): { channel: string; platform: string } {
  // Priority: Meta Lead Ad flag > explicit platform IDs > UTM source > medium > fallback

  // Meta Lead Ads — detected via form_pro_submissions.meta_leadgen_id or fb_lead_id
  if (lead._isMetaLeadAd) {
    return { channel: 'Meta Ads', platform: 'meta' };
  }

  if (lead.utm_source) {
    const src = lead.utm_source.toLowerCase();
    // Meta Ads — all variations of Facebook/Instagram UTM sources
    if (
      lead.fbclid ||
      src === 'fb' || src === 'facebook' || src === 'meta' ||
      src === 'ig' || src === 'instagram' ||
      src.includes('facebook') || src.includes('instagram')
    ) {
      return { channel: 'Meta Ads', platform: 'meta' };
    }
    // Google Ads
    if (lead.gclid || src === 'google' || src.includes('google')) {
      return { channel: 'Google Ads', platform: 'google' };
    }
    if (src.includes('youtube')) return { channel: 'YouTube', platform: 'google' };
    if (src.includes('linkedin')) return { channel: 'LinkedIn', platform: 'linkedin' };
    if (src.includes('whatsapp')) return { channel: 'WhatsApp', platform: 'organic' };
    if (src === 'organic' || lead.utm_medium?.toLowerCase() === 'organic') {
      return { channel: 'Orgânico', platform: 'organic' };
    }
    return { channel: lead.utm_source, platform: lead.utm_source };
  }
  if (lead.fbclid) return { channel: 'Meta Ads', platform: 'meta' };
  if (lead.gclid)  return { channel: 'Google Ads', platform: 'google' };
  if (lead.utm_medium?.toLowerCase() === 'email') return { channel: 'Email', platform: 'email' };
  return { channel: 'Direto', platform: 'direct' };
}

// === Time series helpers ===
function dateToBucket(dateStr: string, granularity: TimeGranularity): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (granularity === 'day') return dateStr.split('T')[0];
  if (granularity === 'week') {
    // ISO week: Monday-based, return Monday date
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff);
    return monday.toISOString().split('T')[0];
  }
  // month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function bucketToLabel(bucket: string, granularity: TimeGranularity): string {
  if (granularity === 'day') {
    const [, m, day] = bucket.split('-');
    return `${day}/${m}`;
  }
  if (granularity === 'week') {
    const d = new Date(bucket + 'T00:00:00');
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    const fmt = (dt: Date) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    return `${fmt(d)} – ${fmt(end)}`;
  }
  // month
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, m] = bucket.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

export function useBIProAttribution(options: UseBIProAttributionOptions = {}) {
  const { period = 'all', dateFrom, dateTo, pipelineId, scoreFilter } = options;

  const dateFilter = useMemo(
    () => buildDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-attribution', period, dateFrom, dateTo, pipelineId, scoreFilter];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AttributionData> => {
      // 1. Fetch leads with UTM + click ID data
      let leadsQ =  
      supabase
        .from('leads')
        .select('id, value, status, created_at, utm_source, utm_medium, utm_campaign, fbclid, gclid, fb_lead_id, leads_stages!inner(leads_pipelines_id)');

      if (pipelineId && pipelineId !== 'all') {
        leadsQ = leadsQ.eq('leads_stages.leads_pipelines_id', pipelineId);
      }
      if (scoreFilter && scoreFilter.length > 0) {
        leadsQ = leadsQ
          .select('id, value, status, created_at, utm_source, utm_medium, utm_campaign, fbclid, gclid, fb_lead_id, leads_stages!inner(leads_pipelines_id), clients_people!inner(score)')
          .in('clients_people.score', scoreFilter);
      }
      if (dateFilter) {
        leadsQ = leadsQ.gte('created_at', dateFilter.from).lte('created_at', dateFilter.to);
      }

      // 2. Fetch ad spend (no embedded join — avoids PostgREST FK cache dependency)
      let spendQ =  
      supabase
        .from('bi_ad_spend')
        .select('spend, platform, campaign_id, date, impressions, clicks, leads');

      if (dateFilter) {
        spendQ = spendQ
          .gte('date', dateFilter.from.split('T')[0])
          .lte('date', dateFilter.to.split('T')[0]);
      }

      // 3. Fetch campaigns separately for name/utm lookup
      const campaignsQ =  
      supabase
        .from('bi_ad_campaigns')
        .select('id, campaign_name, utm_campaign, platform');

      // 4. Fetch FORM PRO™ submissions for Meta Lead Ad detection + LP PRO attribution
      // NOTE: No date filter on submissions — they serve as a lookup signal to identify
      // which leads came from Meta Lead Ads. The leads query already filters by date;
      // filtering submissions too would break attribution when lead.created_at and
      // submission.submitted_at fall in different periods.
       
      const lpSubmissionsQ = supabase
        .from('form_pro_submissions')
        .select('id, lead_id, form_id, meta_leadgen_id, source')
        .not('lead_id', 'is', null);

      // 5. Fetch form names for attribution labels
       
      const formsQ = supabase
        .from('form_pro_forms')
        .select('id, name');

      const [leadsResult, spendResult, campaignsResult, lpSubmissionsResult, formsResult] = await Promise.all([
        leadsQ, spendQ, campaignsQ, lpSubmissionsQ, formsQ,
      ]);

      type LeadRow = {
        id: string;
        value: number | null;
        status: string;
        created_at: string;
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        fbclid: string | null;
        gclid: string | null;
        fb_lead_id: string | null;
      };

      const periodLeads: LeadRow[] = leadsResult.data ?? [];
      const periodLeadIds = new Set(periodLeads.map(l => l.id));

      // Identify Meta Lead Ad lead IDs from submissions (not yet in period leads)
      const submissions = (lpSubmissionsResult.data ?? []) as Array<{
        id: string; lead_id: string; form_id: string | null;
        meta_leadgen_id: string | null; source: string | null;
      }>;
      const metaSubmissionLeadIds = submissions
        .filter(s => (s.meta_leadgen_id || s.source === 'meta') && s.lead_id && !periodLeadIds.has(s.lead_id))
        .map(s => s.lead_id);

      // Fetch Meta Lead Ad leads that fell outside the period filter
      // so they can be attributed to campaigns with spend in the period
      let extraMetaLeads: LeadRow[] = [];
      if (metaSubmissionLeadIds.length > 0) {
        // Supabase .in() has a limit; chunk if needed
        const chunks = [];
        for (let i = 0; i < metaSubmissionLeadIds.length; i += 200) {
          chunks.push(metaSubmissionLeadIds.slice(i, i + 200));
        }
        const results = await Promise.all(
          chunks.map(chunk => {
            let q = supabase
              .from('leads')
              .select('id, value, status, created_at, utm_source, utm_medium, utm_campaign, fbclid, gclid, fb_lead_id, leads_stages!inner(leads_pipelines_id)')
              .in('id', chunk);
            if (pipelineId && pipelineId !== 'all') {
              q = q.eq('leads_stages.leads_pipelines_id', pipelineId);
            }
            return q;
          })
        );
        extraMetaLeads = results.flatMap(r => (r.data ?? []) as LeadRow[]);
      }

      // Period leads = primary dataset for all metrics (respects date filter)
      // Extra Meta leads = only used for campaign attribution (fetched without date filter)
      const leads: LeadRow[] = periodLeads;
      const allLeadsForAttribution: LeadRow[] = [...periodLeads, ...extraMetaLeads];

      const spendRows: Array<{
        spend: number;
        platform: string;
        campaign_id: string | null;
        date: string;
        impressions: number | null;
        clicks: number | null;
        leads: number | null;
      }> = spendResult.data ?? [];

      // Build campaign lookup: id → { campaign_name, utm_campaign }
      const campaignMetaMap = new Map<string, { campaign_name: string; utm_campaign: string | null }>();
      for (const c of (campaignsResult.data ?? []) as Array<{ id: string; campaign_name: string; utm_campaign: string | null }>) {
        campaignMetaMap.set(c.id, { campaign_name: c.campaign_name, utm_campaign: c.utm_campaign });
      }

      // === META LEAD AD DETECTION (via form_pro_submissions.meta_leadgen_id) ===
      // Uses `submissions` already parsed above (no date filter applied).
      const lpSubmissions = submissions;

      const metaLeadAdLeadIds = new Set<string>();
      for (const sub of submissions) {
        if ((sub.meta_leadgen_id || sub.source === 'meta') && sub.lead_id) {
          metaLeadAdLeadIds.add(sub.lead_id);
        }
      }

      // === CHANNEL ATTRIBUTION ===
      const channelMap = new Map<string, {
        platform: string;
        leads: typeof leads;
      }>();

      for (const lead of leads) {
        // Use metaLeadAdLeadIds as primary signal for Meta Lead Ad leads
        const isMetaLeadAd = metaLeadAdLeadIds.has(lead.id) || !!lead.fb_lead_id;
        const { channel, platform } = resolveChannel({ ...lead, _isMetaLeadAd: isMetaLeadAd });
        if (!channelMap.has(channel)) {
          channelMap.set(channel, { platform, leads: [] });
        }
        channelMap.get(channel)!.leads.push(lead);
      }

      // Aggregate spend/impressions/clicks by platform
      const spendByPlatform = new Map<string, { spend: number; impressions: number; clicks: number }>();
      for (const row of spendRows) {
        const current = spendByPlatform.get(row.platform) ?? { spend: 0, impressions: 0, clicks: 0 };
        spendByPlatform.set(row.platform, {
          spend: current.spend + (Number(row.spend) || 0),
          impressions: current.impressions + (Number(row.impressions) || 0),
          clicks: current.clicks + (Number(row.clicks) || 0),
        });
      }

      const byChannel: ChannelAttribution[] = [];
      for (const [channel, { platform, leads: chLeads }] of channelMap.entries()) {
        const won = chLeads.filter(l => l.status === 'won');
        const revenue = won.reduce((s, l) => s + (Number(l.value) || 0), 0);
        const platData = spendByPlatform.get(platform) ?? { spend: 0, impressions: 0, clicks: 0 };
        const spend = platData.spend;
        const cac = spend > 0 && won.length > 0 ? spend / won.length : null;
        const roi = spend > 0 && revenue > 0 ? ((revenue - spend) / spend) * 100 : null;
        const ctr = platData.impressions > 0 ? (platData.clicks / platData.impressions) * 100 : null;
        const cpm = spend > 0 && platData.impressions > 0 ? (spend / platData.impressions) * 1000 : null;
        const costPerLead = spend > 0 && chLeads.length > 0 ? spend / chLeads.length : null;

        byChannel.push({
          channel,
          platform,
          totalLeads: chLeads.length,
          wonLeads: won.length,
          revenue,
          conversionRate: chLeads.length > 0 ? (won.length / chLeads.length) * 100 : 0,
          totalAdSpend: spend,
          impressions: platData.impressions,
          clicks: platData.clicks,
          ctr,
          cpm,
          costPerLead,
          cac,
          roi,
          revenuePerLead: chLeads.length > 0 ? revenue / chLeads.length : 0,
          avgDealValue: won.length > 0 ? revenue / won.length : 0,
        });
      }

      byChannel.sort((a, b) => b.revenue - a.revenue);

      // === CAMPAIGN ATTRIBUTION ===
      // Normalize strings for fuzzy matching: strip accents, lowercase, remove non-alphanumeric
      const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const campaignSpendMap = new Map<string, {
        name: string; platform: string; utm: string | null;
        spend: number; impressions: number; clicks: number; platformLeads: number;
      }>();
      for (const row of spendRows) {
        const key = row.campaign_id ?? `${row.platform}-no-campaign`;
        const meta = row.campaign_id ? campaignMetaMap.get(row.campaign_id) : undefined;
        const name = meta?.campaign_name ?? 'Sem campanha';
        const existing = campaignSpendMap.get(key);
        campaignSpendMap.set(key, {
          name,
          platform: row.platform,
          utm: meta?.utm_campaign ?? null,
          spend: (existing?.spend ?? 0) + (Number(row.spend) || 0),
          impressions: (existing?.impressions ?? 0) + (Number(row.impressions) || 0),
          clicks: (existing?.clicks ?? 0) + (Number(row.clicks) || 0),
          platformLeads: (existing?.platformLeads ?? 0) + (Number(row.leads) || 0),
        });
      }

      // Pre-index leads by utm_campaign for O(1) lookups
      const leadsByUtm = new Map<string, typeof leads>();
      for (const lead of leads) {
        if (!lead.utm_campaign) continue;
        const key = lead.utm_campaign;
        if (!leadsByUtm.has(key)) leadsByUtm.set(key, []);
        leadsByUtm.get(key)!.push(lead);
      }
      // Also index by normalized utm_campaign
      const leadsByNormalizedUtm = new Map<string, typeof leads>();
      for (const lead of leads) {
        if (!lead.utm_campaign) continue;
        const key = normalize(lead.utm_campaign);
        if (!key) continue;
        if (!leadsByNormalizedUtm.has(key)) leadsByNormalizedUtm.set(key, []);
        leadsByNormalizedUtm.get(key)!.push(lead);
      }

      // Collect ALL Meta Lead Ad leads for proportional campaign attribution.
      // These are leads identified via form_pro_submissions (meta_leadgen_id/source)
      // or fb_lead_id. They may or may not have utm_campaign — if they do, they'll
      // first attempt UTM matching (steps 1-2). Any that remain unmatched after
      // UTM matching will be distributed proportionally by spend (step 3).
      // Use allLeadsForAttribution (includes extra Meta leads outside period)
      // so campaign attribution shows all leads tied to the campaign, not just
      // those created in the current period.
      const metaLeadAdLeads = allLeadsForAttribution.filter(l =>
        metaLeadAdLeadIds.has(l.id) || !!l.fb_lead_id
      );

      // Calculate total Meta campaign spend for proportional distribution
      const metaCampaigns = [...campaignSpendMap.entries()].filter(([, c]) => c.platform === 'meta');
      const totalMetaSpend = metaCampaigns.reduce((sum, [, c]) => sum + c.spend, 0);

      // Track which Meta Lead Ad leads are assigned (avoid double-counting)
      const assignedMetaLeadIds = new Set<string>();

      const byCampaign: CampaignAttribution[] = [];
      for (const [, camp] of campaignSpendMap.entries()) {
        // 1. Exact utm_campaign match (best case — manually mapped or populated by sync)
        let campLeads = camp.utm ? (leadsByUtm.get(camp.utm) ?? []) : [];

        // 2. Fuzzy match: normalized campaign_name vs normalized lead.utm_campaign
        if (campLeads.length === 0 && camp.name !== 'Sem campanha') {
          const normalizedName = normalize(camp.name);
          if (normalizedName) {
            // Exact normalized match
            campLeads = leadsByNormalizedUtm.get(normalizedName) ?? [];

            // Contains match: campaign name contains utm or utm contains campaign name
            if (campLeads.length === 0) {
              for (const [normUtm, utmLeads] of leadsByNormalizedUtm.entries()) {
                if (normalizedName.includes(normUtm) || normUtm.includes(normalizedName)) {
                  campLeads = utmLeads;
                  break;
                }
              }
            }
          }
        }

        // Mark any Meta Lead Ad leads already matched by UTM (steps 1-2) as assigned
        for (const l of campLeads) {
          if (metaLeadAdLeadIds.has(l.id) || l.fb_lead_id) {
            assignedMetaLeadIds.add(l.id);
          }
        }

        // 3. Meta Lead Ad attribution: distribute unmatched meta_lead_ad leads
        //    to Meta campaigns. Single campaign = all leads. Multiple = by spend share.
        if (camp.platform === 'meta' && metaLeadAdLeads.length > 0) {
          const unassigned = metaLeadAdLeads.filter(l => !assignedMetaLeadIds.has(l.id));
          if (unassigned.length > 0) {
            let toAssign: typeof unassigned;
            if (metaCampaigns.length === 1) {
              // Single Meta campaign — all Meta Lead Ad leads go here
              toAssign = unassigned;
            } else {
              // Multiple campaigns — distribute by spend proportion
              const spendShare = totalMetaSpend > 0 ? camp.spend / totalMetaSpend : 1 / metaCampaigns.length;
              const allocatedCount = Math.max(1, Math.round(metaLeadAdLeads.length * spendShare));
              toAssign = unassigned.slice(0, allocatedCount);
            }
            for (const l of toAssign) assignedMetaLeadIds.add(l.id);
            // Merge without duplicates
            const existingIds = new Set(campLeads.map(l => l.id));
            campLeads = [...campLeads, ...toAssign.filter(l => !existingIds.has(l.id))];
          }
        }

        const won = campLeads.filter(l => l.status === 'won');
        const revenue = won.reduce((s, l) => s + (Number(l.value) || 0), 0);
        const cac = camp.spend > 0 && won.length > 0 ? camp.spend / won.length : null;
        const roi = camp.spend > 0 && revenue > 0 ? ((revenue - camp.spend) / camp.spend) * 100 : null;
        const costPerLead = camp.spend > 0 && campLeads.length > 0 ? camp.spend / campLeads.length : null;

        const ctr = camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : null;

        byCampaign.push({
          campaignName: camp.name,
          platform: camp.platform as 'meta' | 'google',
          utmCampaign: camp.utm,
          totalLeads: campLeads.length,
          wonLeads: won.length,
          revenue,
          conversionRate: campLeads.length > 0 ? (won.length / campLeads.length) * 100 : 0,
          totalAdSpend: camp.spend,
          cac,
          roi,
          costPerLead,
          impressions: camp.impressions,
          clicks: camp.clicks,
          ctr,
          cpm: camp.spend > 0 && camp.impressions > 0 ? (camp.spend / camp.impressions) * 1000 : null,
          platformLeads: camp.platformLeads,
        });
      }

      byCampaign.sort((a, b) => b.totalAdSpend - a.totalAdSpend);

      // === FORM PRO™ ATTRIBUTION ===
      // lpSubmissions already declared above (Meta Lead Ad detection)

      const formsMap = new Map<string, string>(
        ((formsResult.data ?? []) as Array<{ id: string; name: string }>).map((f) => [f.id, f.name])
      );

      // Build a set of lead IDs from FORM PRO™ submissions
      const lpLeadIds = new Set(lpSubmissions.map((s) => s.lead_id));

      // Map form leads to lead data we already have
      const lpLeadsData = leads.filter((l) => lpLeadIds.has(l.id));

      // Group by form
      const formMap = new Map<string, {
        formId: string;
        formName: string;
        leadIds: Set<string>;
      }>();

      for (const sub of lpSubmissions) {
        const fid = sub.form_id ?? 'unknown';
        if (!formMap.has(fid)) {
          formMap.set(fid, {
            formId: fid,
            formName: formsMap.get(fid) ?? 'Formulário',
            leadIds: new Set(),
          });
        }
        if (sub.lead_id) formMap.get(fid)!.leadIds.add(sub.lead_id);
      }

      const byForm: FormProAttribution[] = [];
      for (const [, form] of formMap.entries()) {
        const formLeads = leads.filter((l) => form.leadIds.has(l.id));
        const won = formLeads.filter((l) => l.status === 'won');
        const revenue = won.reduce((s, l) => s + (Number(l.value) || 0), 0);
        byForm.push({
          formId: form.formId,
          formName: form.formName,
          totalLeads: formLeads.length,
          wonLeads: won.length,
          revenue,
          conversionRate: formLeads.length > 0 ? (won.length / formLeads.length) * 100 : 0,
        });
      }
      byForm.sort((a, b) => b.totalLeads - a.totalLeads);

      const fpWon = lpLeadsData.filter((l) => l.status === 'won');
      const formPro = {
        totalLeads: lpLeadsData.length,
        wonLeads: fpWon.length,
        revenue: fpWon.reduce((s, l) => s + (Number(l.value) || 0), 0),
        byForm,
      };

      // === GLOBAL METRICS ===
      const totalTrackedSpend = [...spendByPlatform.values()].reduce((a, b) => a + b.spend, 0);
      const totalImpressions = spendRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
      const totalClicks = spendRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
      const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
      const overallCPM = totalTrackedSpend > 0 && totalImpressions > 0
        ? (totalTrackedSpend / totalImpressions) * 1000
        : null;
      const allWon = leads.filter(l => l.status === 'won');
      const totalRevenue = allWon.reduce((s, l) => s + (Number(l.value) || 0), 0);
      const overallCAC = totalTrackedSpend > 0 && allWon.length > 0
        ? totalTrackedSpend / allWon.length
        : null;
      const overallROI = totalTrackedSpend > 0 && totalRevenue > 0
        ? ((totalRevenue - totalTrackedSpend) / totalTrackedSpend) * 100
        : null;

      const trackedLeads = leads.filter(l =>
        l.utm_source || l.fbclid || l.gclid || l.utm_campaign || l.utm_medium || l.fb_lead_id || metaLeadAdLeadIds.has(l.id)
      );
      const attributionCoverage = leads.length > 0
        ? (trackedLeads.length / leads.length) * 100
        : 0;

      // === TIME SERIES ===
      // Determine granularity based on period length
      const periodDays = dateFilter
        ? Math.ceil((new Date(dateFilter.to).getTime() - new Date(dateFilter.from).getTime()) / (1000 * 60 * 60 * 24))
        : 90;
      const timeGranularity: TimeGranularity = periodDays <= 21 ? 'day' : periodDays <= 90 ? 'week' : 'month';

      // Build spend map by date bucket
      const spendByBucket = new Map<string, { spend: number; impressions: number; clicks: number }>();
      for (const row of spendRows) {
        const bucket = dateToBucket(row.date, timeGranularity);
        const cur = spendByBucket.get(bucket) ?? { spend: 0, impressions: 0, clicks: 0 };
        spendByBucket.set(bucket, {
          spend: cur.spend + (Number(row.spend) || 0),
          impressions: cur.impressions + (Number(row.impressions) || 0),
          clicks: cur.clicks + (Number(row.clicks) || 0),
        });
      }

      // Build leads map by date bucket
      const leadsByBucket = new Map<string, number>();
      for (const lead of leads) {
        if (!lead.created_at) continue;
        const bucket = dateToBucket(lead.created_at.split('T')[0], timeGranularity);
        leadsByBucket.set(bucket, (leadsByBucket.get(bucket) ?? 0) + 1);
      }

      // Merge into time series
      const allBuckets = new Set([...spendByBucket.keys(), ...leadsByBucket.keys()]);
      const timeSeries: TimeSeriesPoint[] = [...allBuckets]
        .sort()
        .map(bucket => {
          const s = spendByBucket.get(bucket) ?? { spend: 0, impressions: 0, clicks: 0 };
          const l = leadsByBucket.get(bucket) ?? 0;
          return {
            label: bucketToLabel(bucket, timeGranularity),
            date: bucket,
            spend: s.spend,
            impressions: s.impressions,
            clicks: s.clicks,
            leads: l,
            cpl: s.spend > 0 && l > 0 ? s.spend / l : null,
          };
        });

      return {
        byChannel,
        byCampaign,
        totalPeriodLeads: periodLeads.length,
        totalTrackedSpend,
        totalImpressions,
        totalClicks,
        overallCTR,
        overallCPM,
        totalRevenue,
        overallCAC,
        overallROI,
        attributionCoverage,
        timeSeries,
        timeGranularity,
        formPro,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    attribution: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
