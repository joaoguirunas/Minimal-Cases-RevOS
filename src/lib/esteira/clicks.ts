/**
 * clicks — cliques em links rastreados por lead (card do kanban) e como entradas
 * da timeline da esteira. Puro; os hooks só passam as linhas do banco.
 */
import type { TimelineEntry } from '@/hooks/useEsteiraLead';
import type { LeadClickSummary } from './queueSummary';

export interface TrackedLinkRow {
  id: string; lead_id: string | null; people_id?: string | null;
  source: string; label: string | null; template_name: string | null; channel: string | null;
  clicks: number; first_clicked_at: string | null; last_clicked_at: string | null;
  message_id?: number | null; created_at?: string;
}
export interface TrackedClickRow { id: number; tracked_link_id: string; lead_id: string | null; clicked_at: string; device: string | null }

const LABEL_PT: Record<string, string> = {
  link_checkout: 'link do carrinho', link_novo_checkout: 'link de novo checkout', wa_button_url: 'botão do template',
  yampi_enviar_link_carrinho: 'link do carrinho', yampi_enviar_link_pagamento: 'link de pagamento', enviar_link_compra: 'link de compra',
};
const CHANNEL_PT: Record<string, string> = { whatsapp: 'WhatsApp', email: 'E-mail', sms: 'SMS' };
const DEVICE_PT: Record<string, string> = { mobile: 'celular', desktop: 'computador' };

export function describeLinkOrigin(l: Pick<TrackedLinkRow, 'source' | 'label' | 'template_name' | 'channel'>): string {
  if (l.source === 'agente') return `Agente · ${LABEL_PT[l.label ?? ''] ?? 'link'}`;
  const canal = CHANNEL_PT[l.channel ?? ''] ?? (l.source === 'esteira_whatsapp' ? 'WhatsApp' : l.source === 'esteira_email' ? 'E-mail' : l.source === 'esteira_sms' ? 'SMS' : 'Link');
  return l.template_name ? `${canal} · ${l.template_name}` : canal;
}

export function summarizeLinkClicks(links: TrackedLinkRow[]): Record<string, LeadClickSummary> {
  const out: Record<string, LeadClickSummary> = {};
  for (const l of links) {
    if (!l.lead_id || l.clicks <= 0) continue;
    const s = (out[l.lead_id] ??= { total: 0, links: 0, firstAt: null, lastAt: null });
    s.total += l.clicks; s.links++;
    if (l.first_clicked_at && (!s.firstAt || l.first_clicked_at < s.firstAt)) s.firstAt = l.first_clicked_at;
    if (l.last_clicked_at && (!s.lastAt || l.last_clicked_at > s.lastAt)) s.lastAt = l.last_clicked_at;
  }
  return out;
}

const ordinal = (n: number) => `${n}º clique`;

export function clicksToTimeline(links: TrackedLinkRow[], clicks: TrackedClickRow[]): TimelineEntry[] {
  const byId = new Map(links.map((l) => [l.id, l]));
  const out: TimelineEntry[] = [];
  const perLink = new Map<string, number>();
  const sorted = [...clicks].sort((a, b) => (a.clicked_at < b.clicked_at ? -1 : 1));
  for (const c of sorted) {
    const link = byId.get(c.tracked_link_id);
    if (!link) continue;
    const n = (perLink.get(link.id) ?? 0) + 1;
    perLink.set(link.id, n);
    const dev = DEVICE_PT[c.device ?? ''] ?? null;
    const detail = [n > 1 ? ordinal(n) : null, dev].filter(Boolean).join(' · ') || undefined;
    out.push({ id: `click-${c.id}`, at: c.clicked_at, kind: 'clique', type: link.channel ?? link.source, title: `Abriu o link · ${describeLinkOrigin(link)}`, detail });
  }
  // Nenhum clique individual veio na chamada: dados de antes da tabela de
  // eventos existir. Cai para uma entrada por link a partir do agregado.
  if (clicks.length === 0) {
    for (const l of links) {
      if (l.clicks > 0 && l.first_clicked_at) {
        out.push({ id: `click-legacy-${l.id}`, at: l.first_clicked_at, kind: 'clique', type: l.channel ?? l.source, title: `Abriu o link · ${describeLinkOrigin(l)}`, detail: l.clicks > 1 ? `${l.clicks} cliques` : undefined });
      }
    }
  }
  return out;
}
