/**
 * queueSummary — agrega a followup_queue por lead para os cards do kanban.
 *
 * Enviados (sent/queued/delivered/read), pendentes (pending/processing),
 * falhos e cancelados. Cancelados não entram no total. O "próximo toque" é o
 * pendente com o menor scheduled_for.
 */

export interface QueueRow { lead_id: string; channel: string; status: string; scheduled_for: string | null; subject?: string | null }
export type Channel = 'email' | 'whatsapp' | 'sms';
export interface LeadClickSummary { total: number; links: number; firstAt: string | null; lastAt: string | null }
export interface LeadQueueSummary {
  sent: Record<Channel, number> & { total: number };
  pending: number; failed: number; cancelled: number; total: number;
  nextAt: string | null; nextChannel: Channel | null; nextLabel: string | null;
  clicks: LeadClickSummary;
}

export function channelOf(raw: string): Channel {
  if (raw === 'email') return 'email';
  if (raw === 'sms') return 'sms';
  return 'whatsapp'; // whatsapp_template, whatsapp_texto, etc.
}

const SENT = new Set(['sent', 'queued', 'delivered', 'read']);

export function emptyQueueSummary(): LeadQueueSummary {
  return { sent: { email: 0, whatsapp: 0, sms: 0, total: 0 }, pending: 0, failed: 0, cancelled: 0, total: 0, nextAt: null, nextChannel: null, nextLabel: null, clicks: { total: 0, links: 0, firstAt: null, lastAt: null } };
}

export function summarizeQueue(rows: QueueRow[]): Record<string, LeadQueueSummary> {
  const out: Record<string, LeadQueueSummary> = {};
  for (const r of rows) {
    const s = (out[r.lead_id] ??= emptyQueueSummary());
    const ch = channelOf(r.channel);
    if (SENT.has(r.status)) { s.sent[ch]++; s.sent.total++; s.total++; }
    else if (r.status === 'pending' || r.status === 'processing') {
      s.pending++; s.total++;
      if (r.scheduled_for && (!s.nextAt || r.scheduled_for < s.nextAt)) {
        s.nextAt = r.scheduled_for; s.nextChannel = ch; s.nextLabel = r.subject ?? null;
      }
    }
    else if (r.status === 'failed') { s.failed++; s.total++; }
    else if (r.status === 'cancelled') { s.cancelled++; }
  }
  return out;
}
