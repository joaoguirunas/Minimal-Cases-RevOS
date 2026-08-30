import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDateFilter } from '@/hooks/bipro-date-utils';

export interface OmniByChannel {
  channel: string;
  total: number;
  enviadas: number;
  recebidas: number;
  delivered: number;
  read: number;
  deliveryRate: number;
  readRate: number;
  outboundRatio: number;  // enviadas / total (0–1)
}

export interface OmniByHour {
  hour: number;   // 0–23
  total: number;
  outbound: number;
  inbound: number;
}

export interface OmniVolumePoint {
  date: string;
  whatsapp: number;
  email: number;
  phone: number;
  other: number;
}

export interface OmniTopLead {
  leadId: string;
  leadName: string | null;
  canal: string;
  totalMsgs: number;
  ultimaInteracao: string;
}

export interface OmniByAgent {
  userId: string;
  name: string;
  totalSent: number;
  conversationsHandled: number;
  openConversations: number;
  avgResponseTimeMin: number | null;
}

export interface BIProOmniData {
  byChannel: OmniByChannel[];
  volumeOverTime: OmniVolumePoint[];
  byHour: OmniByHour[];
  avgResponseTime: number | null;
  topLeads: OmniTopLead[];
  openConversations: number;
  totalMessages: number;
  byAgent: OmniByAgent[];
}

export interface UseBIProOmniOptions {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
}

type MessageRow = {
  id: string;
  channel: string | null;
  from_contact: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  status: string | null;
  lead_id: string | null;
  user_id: string | null;
  people_id: string | null;
};

export function useBIProOmni(options: UseBIProOmniOptions = {}) {
  const { period = 'all', dateFrom, dateTo, pipelineId, scoreFilter } = options;

  const dateFilter = useMemo(
    () => buildDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-omni', period, dateFrom, dateTo, pipelineId, scoreFilter];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<BIProOmniData> => {
      let msgQ = supabase
        .from('messages')
        .select('id, channel, from_contact, sent_at, delivered_at, read_at, status, lead_id, user_id, people_id')
        .order('sent_at', { ascending: true });

      if (dateFilter) {
        msgQ = msgQ.gte('sent_at', dateFilter.from).lte('sent_at', dateFilter.to);
      }

      const usersQ = supabase.from('settings_users').select('id, name');

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

      const [{ data, error }, usersResult, pipelineLeadIdsResult, scoreLeadIdsResult] = await Promise.all([
        msgQ, usersQ, pipelineLeadIdsQ, scoreLeadIdsQ,
      ]);
      if (error) throw error;

      let messages: MessageRow[] = data ?? [];

      // Apply pipeline filter
      if (pipelineId && pipelineId !== 'all' && pipelineLeadIdsResult.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allowedIds = new Set((pipelineLeadIdsResult.data as any[]).map((r: any) => r.id));
        messages = messages.filter(m => m.lead_id && allowedIds.has(m.lead_id));
      }

      // Apply score filter
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

      const agentNames = new Map<string, string>(
        (usersResult.data ?? []).map((u: { id: string; name: string }) => [u.id, u.name])
      );

      if (messages.length === 0) {
        return {
          byChannel: [],
          volumeOverTime: [],
          byHour: [],
          avgResponseTime: null,
          topLeads: [],
          openConversations: 0,
          totalMessages: 0,
          byAgent: [],
        };
      }

      // === LEAD NAMES (via clients_people) ===
      const uniquePeopleIds = [...new Set(messages.map(m => m.people_id).filter((p): p is string => !!p))];
      const { data: peopleData } = uniquePeopleIds.length > 0
        ? await supabase.from('clients_people').select('id, name').in('id', uniquePeopleIds.slice(0, 500))
        : { data: [] as Array<{ id: string; name: string | null }> };
      const peopleMap = new Map<string, string>(
        (peopleData ?? []).filter(p => p.name).map(p => [p.id, p.name as string])
      );
      // Map: lead_id → display name (first match wins)
      const leadNameMap = new Map<string, string>();
      for (const msg of messages) {
        if (msg.lead_id && msg.people_id && !leadNameMap.has(msg.lead_id)) {
          const name = peopleMap.get(msg.people_id);
          if (name) leadNameMap.set(msg.lead_id, name);
        }
      }

      // === BY CHANNEL ===
      const channelMap = new Map<string, { total: number; enviadas: number; recebidas: number; delivered: number; read: number }>();
      for (const msg of messages) {
        const ch = msg.channel ?? 'unknown';
        if (!channelMap.has(ch)) {
          channelMap.set(ch, { total: 0, enviadas: 0, recebidas: 0, delivered: 0, read: 0 });
        }
        const c = channelMap.get(ch)!;
        c.total++;
        if (msg.from_contact === 'cliente') {
          c.recebidas++;
        } else {
          c.enviadas++;
          if (msg.delivered_at) c.delivered++;
          if (msg.read_at) c.read++;
        }
      }

      const byChannel: OmniByChannel[] = [...channelMap.entries()].map(([channel, d]) => ({
        channel,
        total: d.total,
        enviadas: d.enviadas,
        recebidas: d.recebidas,
        delivered: d.delivered,
        read: d.read,
        deliveryRate: d.enviadas > 0 ? (d.delivered / d.enviadas) * 100 : 0,
        readRate: d.delivered > 0 ? (d.read / d.delivered) * 100 : 0,
        outboundRatio: d.total > 0 ? d.enviadas / d.total : 0,
      })).sort((a, b) => b.total - a.total);

      // === VOLUME OVER TIME ===
      const dateVolumeMap = new Map<string, OmniVolumePoint>();
      for (const msg of messages) {
        const dateKey = (msg.sent_at ?? '').split('T')[0];
        if (!dateKey) continue;
        if (!dateVolumeMap.has(dateKey)) {
          dateVolumeMap.set(dateKey, { date: dateKey, whatsapp: 0, email: 0, phone: 0, other: 0 });
        }
        const p = dateVolumeMap.get(dateKey)!;
        const ch = (msg.channel ?? '').toLowerCase();
        if (ch.includes('whatsapp') || ch === 'wa') p.whatsapp++;
        else if (ch.includes('email') || ch === 'mail') p.email++;
        else if (ch.includes('phone') || ch.includes('call') || ch === 'sms') p.phone++;
        else p.other++;
      }
      const volumeOverTime = [...dateVolumeMap.values()].sort((a, b) => a.date.localeCompare(b.date));

      // === AVG RESPONSE TIME ===
      // Group by lead_id, find pairs: from_contact='cliente' followed by any outbound (!= 'cliente')
      const byLead = new Map<string, MessageRow[]>();
      for (const msg of messages) {
        if (!msg.lead_id) continue;
        if (!byLead.has(msg.lead_id)) byLead.set(msg.lead_id, []);
        byLead.get(msg.lead_id)!.push(msg);
      }

      const responseTimes: number[] = [];
      for (const [, leadMsgs] of byLead.entries()) {
        const sorted = leadMsgs.sort((a, b) => (a.sent_at ?? '').localeCompare(b.sent_at ?? ''));
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].from_contact === 'cliente' && sorted[i + 1].from_contact !== 'cliente') {
            const diff = new Date(sorted[i + 1].sent_at ?? '').getTime() - new Date(sorted[i].sent_at ?? '').getTime();
            const minutes = diff / (1000 * 60);
            if (minutes > 0 && minutes < 1440) responseTimes.push(minutes); // max 24h
          }
        }
      }
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : null;

      // === TOP LEADS ===
      const leadMsgCount = new Map<string, { canal: string; count: number; ultima: string }>();
      for (const msg of messages) {
        if (!msg.lead_id) continue;
        const existing = leadMsgCount.get(msg.lead_id);
        if (!existing) {
          leadMsgCount.set(msg.lead_id, { canal: msg.channel ?? 'unknown', count: 1, ultima: msg.sent_at ?? '' });
        } else {
          existing.count++;
          if ((msg.sent_at ?? '') > existing.ultima) existing.ultima = msg.sent_at ?? '';
        }
      }

      const topLeads: OmniTopLead[] = [...leadMsgCount.entries()]
        .map(([leadId, d]) => ({
          leadId,
          leadName: leadNameMap.get(leadId) ?? null,
          canal: d.canal,
          totalMsgs: d.count,
          ultimaInteracao: d.ultima,
        }))
        .sort((a, b) => b.totalMsgs - a.totalMsgs)
        .slice(0, 20);

      // === OPEN CONVERSATIONS ===
      // Leads where last message is from_contact=true (waiting for response)
      let openConversations = 0;
      for (const [, leadMsgs] of byLead.entries()) {
        const sorted = leadMsgs.sort((a, b) => (a.sent_at ?? '').localeCompare(b.sent_at ?? ''));
        const last = sorted[sorted.length - 1];
        if (last?.from_contact === 'cliente') openConversations++;
      }

      // === BY AGENT ===
      // Group outbound messages by user_id + compute response times per agent
      const agentMap = new Map<string, {
        sent: number;
        leadsHandled: Set<string>;
        openConvs: number;
        responseTimes: number[];
      }>();

      // Build per-lead message lists for agent-level response time
      const byLeadForAgent = new Map<string, MessageRow[]>();
      for (const msg of messages) {
        if (!msg.lead_id) continue;
        if (!byLeadForAgent.has(msg.lead_id)) byLeadForAgent.set(msg.lead_id, []);
        byLeadForAgent.get(msg.lead_id)!.push(msg);
      }

      for (const [leadId, leadMsgs] of byLeadForAgent.entries()) {
        const sorted = leadMsgs.sort((a, b) => (a.sent_at ?? '').localeCompare(b.sent_at ?? ''));
        const lastMsg = sorted[sorted.length - 1];

        for (let i = 0; i < sorted.length; i++) {
          const msg = sorted[i];
          const uid = msg.user_id ?? '__no_agent__';
          if (msg.from_contact === 'cliente') continue; // only outbound

          if (!agentMap.has(uid)) agentMap.set(uid, { sent: 0, leadsHandled: new Set(), openConvs: 0, responseTimes: [] });
          const a = agentMap.get(uid)!;
          a.sent++;
          a.leadsHandled.add(leadId);

          // Response time: time between incoming (from_contact=true) and this outbound reply
          if (i > 0 && sorted[i - 1].from_contact === 'cliente') {
            const diff = new Date(msg.sent_at ?? '').getTime() - new Date(sorted[i - 1].sent_at ?? '').getTime();
            const mins = diff / (1000 * 60);
            if (mins > 0 && mins < 1440) a.responseTimes.push(mins);
          }
        }

        // Open conversation attribution: last outbound msg agent
        if (lastMsg?.from_contact === 'cliente') {
          // find last agent who sent a message
          const lastAgentMsg = [...sorted].reverse().find(m => m.from_contact !== 'cliente' && m.user_id);
          if (lastAgentMsg?.user_id) {
            const uid = lastAgentMsg.user_id;
            if (!agentMap.has(uid)) agentMap.set(uid, { sent: 0, leadsHandled: new Set(), openConvs: 0, responseTimes: [] });
            agentMap.get(uid)!.openConvs++;
          }
        }
      }

      const byAgent: OmniByAgent[] = [...agentMap.entries()]
        .filter(([uid]) => uid !== '__no_agent__')
        .map(([userId, d]) => ({
          userId,
          name: agentNames.get(userId) ?? userId.slice(0, 8),
          totalSent: d.sent,
          conversationsHandled: d.leadsHandled.size,
          openConversations: d.openConvs,
          avgResponseTimeMin: d.responseTimes.length > 0
            ? d.responseTimes.reduce((a, b) => a + b, 0) / d.responseTimes.length
            : null,
        }))
        .sort((a, b) => b.totalSent - a.totalSent);

      // === BY HOUR (peak hours) ===
      const hourMap = new Map<number, { total: number; outbound: number; inbound: number }>();
      for (let h = 0; h < 24; h++) hourMap.set(h, { total: 0, outbound: 0, inbound: 0 });
      for (const msg of messages) {
        if (!msg.sent_at) continue;
        const hour = new Date(msg.sent_at).getHours();
        const entry = hourMap.get(hour)!;
        entry.total++;
        if (msg.from_contact === 'cliente') entry.inbound++;
        else entry.outbound++;
      }
      const byHour: OmniByHour[] = [...hourMap.entries()]
        .map(([hour, d]) => ({ hour, ...d }))
        .sort((a, b) => a.hour - b.hour);

      return {
        byChannel,
        volumeOverTime,
        byHour,
        avgResponseTime,
        topLeads,
        openConversations,
        totalMessages: messages.length,
        byAgent,
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
