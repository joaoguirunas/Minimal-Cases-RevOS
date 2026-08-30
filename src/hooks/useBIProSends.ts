import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDateFilter } from '@/hooks/bipro-date-utils';

export interface SendsByFollowup {
  followupId: string;
  name: string;
  stageName: string;
  delayMinutes: number | null;
  totalSent: number;
  totalReplied: number;
  replyRate: number;
  leadsAdvanced: number;
  conversionRate: number;
}

export interface SendsByStage {
  stageName: string;
  totalFollowups: number;
  avgReplyRate: number;
}

export interface SendsVolumePoint {
  date: string;
  count: number;
}

export interface BIProSendsData {
  byFollowup: SendsByFollowup[];
  byStage: SendsByStage[];
  volumeOverTime: SendsVolumePoint[];
  overallReplyRate: number;
  overallConversionRate: number;
  totalSent: number;
  totalReplied: number;
}

export interface UseBIProSendsOptions {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

export function useBIProSends(options: UseBIProSendsOptions = {}) {
  const { period = 'all', dateFrom, dateTo, pipelineId, scoreFilter } = options;

  const dateFilter = useMemo(
    () => buildDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-sends', period, dateFrom, dateTo, pipelineId, scoreFilter];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<BIProSendsData> => {
      // Q1: followup configs with stage name
      const followupsQ = supabase
        .from('leads_stages_followups')
        .select('id, name, leads_stages_id, delay_minutes, leads_stages(name)')
        .eq('active', true);

      // Q2: messages sent by followup
      let msgsQ = supabase
        .from('messages')
        .select('id, followup_id, lead_id, sent_at, from_contact')
        .not('followup_id', 'is', null);

      if (dateFilter) {
        msgsQ = msgsQ.gte('sent_at', dateFilter.from).lte('sent_at', dateFilter.to);
      }

      // Q3: leads_updates in period (stage advances)
      let updatesQ = supabase
        .from('leads_updates')
        .select('lead_id, to_stage_id, created_at');

      if (dateFilter) {
        updatesQ = updatesQ.gte('created_at', dateFilter.from).lte('created_at', dateFilter.to);
      }

      // Pipeline filter: fetch lead IDs in the selected pipeline
      const pipelineLeadIdsQ = pipelineId && pipelineId !== 'all'
        ? supabase
            .from('leads')
            .select('id, leads_stages!inner(leads_pipelines_id)')
            .eq('leads_stages.leads_pipelines_id', pipelineId)
        : Promise.resolve({ data: null });

      // Score filter: fetch lead IDs matching the score
      const scoreLeadIdsQ = scoreFilter && scoreFilter.length > 0
        ? supabase
            .from('clients_people')
            .select('leads!inner(id)')
            .in('score', scoreFilter)
        : Promise.resolve({ data: null });

      const [followupsResult, msgsResult, updatesResult, pipelineLeadIdsResult, scoreLeadIdsResult] = await Promise.all([
        followupsQ, msgsQ, updatesQ, pipelineLeadIdsQ, scoreLeadIdsQ,
      ]);

      const followups: Array<{
        id: string;
        name: string;
        leads_stages_id: string | null;
        delay_minutes: number | null;
        leads_stages: { name: string } | null;
      }> = followupsResult.data ?? [];

      let messages: Array<{
        id: string;
        followup_id: string | null;
        lead_id: string | null;
        sent_at: string | null;
        from_contact: string | null;
      }> = msgsResult.data ?? [];

      const updates: Array<{
        lead_id: string;
        to_stage_id: string | null;
        created_at: string;
      }> = updatesResult.data ?? [];

      // Apply pipeline filter to messages
      if (pipelineId && pipelineId !== 'all' && pipelineLeadIdsResult.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allowedIds = new Set((pipelineLeadIdsResult.data as any[]).map((r: any) => r.id));
        messages = messages.filter(m => m.lead_id && allowedIds.has(m.lead_id));
      }

      // Apply score filter to messages
      if (scoreFilter && scoreFilter.length > 0 && scoreLeadIdsResult.data) {
        const allowedIds = new Set(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (scoreLeadIdsResult.data as any[]).flatMap((row: any) => {
            const leads = row.leads;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (Array.isArray(leads)) return leads.map((l: any) => l.id);
            if (leads?.id) return [leads.id];
            return [];
          })
        );
        messages = messages.filter(m => m.lead_id && allowedIds.has(m.lead_id));
      }

      if (followups.length === 0) {
        return {
          byFollowup: [],
          byStage: [],
          volumeOverTime: [],
          overallReplyRate: 0,
          overallConversionRate: 0,
          totalSent: 0,
          totalReplied: 0,
        };
      }

      // Group sent messages by followup_id
      const msgsByFollowup = new Map<string, typeof messages>();
      for (const msg of messages) {
        if (!msg.followup_id) continue;
        if (!msgsByFollowup.has(msg.followup_id)) msgsByFollowup.set(msg.followup_id, []);
        msgsByFollowup.get(msg.followup_id)!.push(msg);
      }

      // Group all messages by lead_id for quick reply lookup
      const allMsgsByLead = new Map<string, typeof messages>();
      for (const msg of messages) {
        if (!msg.lead_id) continue;
        if (!allMsgsByLead.has(msg.lead_id)) allMsgsByLead.set(msg.lead_id, []);
        allMsgsByLead.get(msg.lead_id)!.push(msg);
      }

      // Group updates by lead_id
      const updatesByLead = new Map<string, typeof updates>();
      for (const u of updates) {
        if (!updatesByLead.has(u.lead_id)) updatesByLead.set(u.lead_id, []);
        updatesByLead.get(u.lead_id)!.push(u);
      }

      const byFollowup: SendsByFollowup[] = followups.map(fu => {
        const sent = msgsByFollowup.get(fu.id) ?? [];
        // Only outbound sends (from_contact=false or null)
        const sentOutbound = sent.filter(m => m.from_contact !== 'true');
        const uniqueLeadsSent = new Set(sentOutbound.map(m => m.lead_id).filter(Boolean));

        let replied = 0;
        let advanced = 0;

        for (const leadId of uniqueLeadsSent) {
          if (!leadId) continue;
          const leadMsgs = allMsgsByLead.get(leadId) ?? [];
          const sendTimes = sentOutbound.filter(m => m.lead_id === leadId).map(m => new Date(m.sent_at ?? '').getTime());
          const earliestSend = Math.min(...sendTimes);

          // Replied: from_contact=true within 24h of earliest send
          const hasReply = leadMsgs.some(m =>
            m.from_contact === 'true' &&
            new Date(m.sent_at ?? '').getTime() > earliestSend &&
            new Date(m.sent_at ?? '').getTime() < earliestSend + 24 * 60 * 60 * 1000
          );
          if (hasReply) replied++;

          // Advanced: leads_update within 48h
          const leadUpdates = updatesByLead.get(leadId) ?? [];
          const hasAdvance = leadUpdates.some(u =>
            new Date(u.created_at).getTime() > earliestSend &&
            new Date(u.created_at).getTime() < earliestSend + 48 * 60 * 60 * 1000
          );
          if (hasAdvance) advanced++;
        }

        const totalSent = uniqueLeadsSent.size;
        return {
          followupId: fu.id,
          name: fu.name,
          stageName: fu.leads_stages?.name ?? '—',
          delayMinutes: fu.delay_minutes ?? null,
          totalSent,
          totalReplied: replied,
          replyRate: totalSent > 0 ? (replied / totalSent) * 100 : 0,
          leadsAdvanced: advanced,
          conversionRate: totalSent > 0 ? (advanced / totalSent) * 100 : 0,
        };
      }).sort((a, b) => b.totalSent - a.totalSent);

      // === BY STAGE ===
      const stageFollowupMap = new Map<string, SendsByFollowup[]>();
      for (const fu of byFollowup) {
        if (!stageFollowupMap.has(fu.stageName)) stageFollowupMap.set(fu.stageName, []);
        stageFollowupMap.get(fu.stageName)!.push(fu);
      }

      const byStage: SendsByStage[] = [...stageFollowupMap.entries()].map(([stageName, fus]) => ({
        stageName,
        totalFollowups: fus.length,
        avgReplyRate: fus.length > 0 ? fus.reduce((a, b) => a + b.replyRate, 0) / fus.length : 0,
      }));

      // === VOLUME OVER TIME ===
      const dateMap = new Map<string, number>();
      for (const msg of messages) {
        if (msg.from_contact === 'true') continue;
        const dateKey = (msg.sent_at ?? '').split('T')[0];
        if (!dateKey) continue;
        dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + 1);
      }
      const volumeOverTime: SendsVolumePoint[] = [...dateMap.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalSent = byFollowup.reduce((a, b) => a + b.totalSent, 0);
      const totalReplied = byFollowup.reduce((a, b) => a + b.totalReplied, 0);

      return {
        byFollowup,
        byStage,
        volumeOverTime,
        overallReplyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
        overallConversionRate: totalSent > 0 ? (byFollowup.reduce((a, b) => a + b.leadsAdvanced, 0) / totalSent) * 100 : 0,
        totalSent,
        totalReplied,
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
