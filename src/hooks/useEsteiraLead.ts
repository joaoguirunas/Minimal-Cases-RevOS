/**
 * useEsteiraLead — dados da esteira de recuperação para cards e página do lead (EST-UI).
 *
 *  - useTouchCountsByLead: nº de toques ENVIADOS (followup_queue.status='sent')
 *    por lead, agrupado por canal — chips do kanban.
 *  - useLeadEsteira: carrinho (Yampi events → fallback Zoppy) + timeline unificada
 *    (eventos da loja + toques da esteira com nome do template/assunto).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeQueue, type LeadQueueSummary, type QueueRow } from '@/lib/esteira/queueSummary';

// Tabelas yampi_*/zoppy_* ainda não estão nos types gerados.
const db = supabase as unknown as SupabaseClient;

// ── Toques por lead (kanban) ────────────────────────────────────────────────────

export interface TouchCounts {
  email: number;
  whatsapp: number;
  sms: number;
  total: number;
}

export function useTouchCountsByLead(leadIds: string[]) {
  return useQuery({
    queryKey: ['esteira', 'touches', leadIds],
    queryFn: async (): Promise<Record<string, TouchCounts>> => {
      if (leadIds.length === 0) return {};
      const { data, error } = await db
        .from('followup_queue')
        .select('lead_id, channel')
        .eq('status', 'sent')
        .in('lead_id', leadIds);
      if (error) throw error;
      const out: Record<string, TouchCounts> = {};
      for (const row of (data ?? []) as Array<{ lead_id: string; channel: string }>) {
        const t = out[row.lead_id] ?? (out[row.lead_id] = { email: 0, whatsapp: 0, sms: 0, total: 0 });
        if (row.channel === 'email') t.email++;
        else if (row.channel === 'sms') t.sms++;
        else t.whatsapp++;
        t.total++;
      }
      return out;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });
}

/** Dados da esteira por card do kanban: enviados por canal, pendentes, próximo toque. Uma query por lista. */
export function useEsteiraCardData(leadIds: string[]) {
  const key = [...leadIds].sort().join(',');
  return useQuery({
    queryKey: ['esteira', 'card-data', key],
    enabled: leadIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, LeadQueueSummary>> => {
      const { data, error } = await db
        .from('followup_queue')
        .select('lead_id, channel, status, scheduled_for, subject')
        .in('lead_id', leadIds)
        .in('status', ['sent', 'queued', 'delivered', 'read', 'pending', 'processing', 'failed', 'cancelled']);
      if (error) throw error;
      return summarizeQueue((data ?? []) as QueueRow[]);
    },
  });
}

// ── Carrinho + timeline (página do lead) ───────────────────────────────────────

export interface CartItem {
  title: string;
  quantity: number;
  price: number | null;
}

export interface LeadCart {
  source: 'yampi' | 'zoppy';
  items: CartItem[];
  total: number | null;
  url: string | null;
  createdAt: string | null;
}

export interface TimelineEntry {
  id: string;
  at: string;
  kind: 'evento' | 'toque';
  /** evento: trigger yampi/zoppy; toque: canal */
  type: string;
  title: string;
  detail?: string;
  status?: string; // toques: sent | pending | failed | cancelled
}

const TRIGGER_TITLES: Record<string, string> = {
  checkout_iniciado: 'Entrou no checkout',
  carrinho_abandonado: 'Carrinho abandonado',
  pix_gerado: 'Pix gerado',
  boleto_gerado: 'Boleto gerado',
  pedido_criado: 'Pedido criado',
  pagamento_recusado: 'Pagamento recusado',
  pedido_pago: 'Compra finalizada',
  pedido_cancelado: 'Pedido cancelado',
  pedido_status_atualizado: 'Status do pedido atualizado',
};

type AnyRec = Record<string, unknown>;
const rec = (v: unknown): AnyRec => (v && typeof v === 'object' && !Array.isArray(v) ? v as AnyRec : {});

function parseYampiCart(raw: AnyRec): { items: CartItem[]; total: number | null; url: string | null } {
  const resource = rec(raw.resource);
  const itemsData = (rec(resource.items).data ?? resource.items) as unknown;
  const items: CartItem[] = [];
  if (Array.isArray(itemsData)) {
    for (const it of itemsData) {
      const item = rec(it);
      const sku = rec(rec(item.sku).data);
      // Preço efetivo: item.price é o valor cobrado; price_sale pode vir 0 no
      // catálogo Yampi mesmo com o SKU ativo (price_discount guarda o real).
      const price = [item.price, sku.price_discount, sku.price_sale]
        .find((v): v is number => typeof v === 'number' && v > 0) ?? null;
      items.push({
        title: String(sku.title ?? item.title ?? 'Item'),
        quantity: Number(item.quantity ?? 1) || 1,
        price,
      });
    }
  }
  const totalizers = rec(resource.totalizers);
  const total = typeof totalizers.total === 'number' ? totalizers.total
    : typeof resource.value_total === 'number' ? resource.value_total as number : null;
  // simulate_url primeiro: carrinho de cliente logado só restaura com o
  // customerToken — a versão unauth (forceLogout=1) derruba a sessão e a Yampi
  // devolve carrinho vazio (caso Ari Chaves). Pra convidado, ambas funcionam.
  const url = (resource.simulate_url ?? resource.unauth_simulate_url ?? null) as string | null;
  return { items, total, url };
}

function parseZoppyItems(lineItems: unknown): CartItem[] {
  if (!Array.isArray(lineItems)) return [];
  return lineItems.map((it) => {
    const r = rec(it);
    return {
      title: String(rec(r.product).name ?? r.name ?? r.title ?? 'Item'),
      quantity: Number(r.quantity ?? 1) || 1,
      price: typeof r.price === 'number' ? r.price : null,
    };
  });
}

const CHANNEL_TITLES: Record<string, string> = {
  email: 'E-mail',
  sms: 'SMS',
  whatsapp_template: 'WhatsApp',
  whatsapp_texto: 'WhatsApp',
  ligacao: 'Ligação',
};

export function useLeadEsteira(leadId?: string, peopleId?: string) {
  return useQuery({
    queryKey: ['esteira', 'lead', leadId, peopleId],
    enabled: !!leadId,
    staleTime: 20_000,
    queryFn: async (): Promise<{ cart: LeadCart | null; timeline: TimelineEntry[] }> => {
      const timeline: TimelineEntry[] = [];
      let cart: LeadCart | null = null;

      // ── Toques da esteira (followup_queue do lead) ──────────────────────────
      const { data: touches } = await db
        .from('followup_queue')
        .select('id, channel, status, scheduled_for, fired_at, subject, created_at, followup:leads_stages_followups(subject, type, email_template:email_templates(name))')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(60);
      for (const t of (touches ?? []) as Array<AnyRec>) {
        const fu = rec(t.followup);
        const tplName = rec(fu.email_template).name as string | undefined;
        const canal = CHANNEL_TITLES[String(t.channel)] ?? String(t.channel);
        const label = tplName ?? (t.subject as string | null) ?? (fu.subject as string | null) ?? 'Follow-up';
        const status = String(t.status);
        timeline.push({
          id: `touch-${t.id}`,
          at: String(t.fired_at ?? t.scheduled_for ?? t.created_at),
          kind: 'toque',
          type: String(t.channel),
          title: `${canal} · ${label}`,
          detail: status === 'pending' ? 'agendado' : status === 'sent' ? 'enviado' : status,
          status,
        });
      }

      if (peopleId) {
        // ── Eventos da loja (Yampi) ───────────────────────────────────────────
        const { data: events } = await db
          .from('yampi_webhook_events')
          .select('id, trigger, event_type, order_id, created_at, raw_payload')
          .eq('people_id', peopleId)
          .order('created_at', { ascending: false })
          .limit(40);
        for (const ev of (events ?? []) as Array<AnyRec>) {
          const trig = String(ev.trigger ?? ev.event_type);
          const payload = rec(ev.raw_payload);
          // Data REAL do carrinho (backfill importa dias depois do abandono —
          // ev.created_at seria a data do import, não a do carrinho).
          const res = rec(payload.resource);
          const resDateRaw = (rec(res.created_at).date as string | undefined) ??
            (typeof res.created_at === 'string' ? res.created_at : undefined);
          const cartAt = resDateRaw ? resDateRaw.replace(' ', 'T') : null;
          const isBackfill = payload.origin === 'backfill';
          timeline.push({
            id: `event-${ev.id}`,
            at: isBackfill && cartAt ? cartAt : String(ev.created_at),
            kind: 'evento',
            type: trig,
            title: TRIGGER_TITLES[trig] ?? trig,
            detail: ev.order_id ? `pedido ${ev.order_id}` : undefined,
          });
          // Carrinho mais recente com itens vira o card de detalhes.
          if (!cart && ['carrinho_abandonado', 'checkout_iniciado'].includes(trig)) {
            const parsed = parseYampiCart(payload);
            if (parsed.items.length > 0 || parsed.url) {
              cart = { source: 'yampi', ...parsed, createdAt: cartAt ?? String(ev.created_at) };
            }
          }
        }

        // ── Fallback: carrinho histórico da Zoppy ─────────────────────────────
        if (!cart) {
          const { data: zcarts } = await db
            .from('zoppy_abandoned_carts')
            .select('url, total, line_items, zoppy_created_at')
            .eq('people_id', peopleId)
            .order('zoppy_created_at', { ascending: false })
            .limit(1);
          const z = (zcarts ?? [])[0] as AnyRec | undefined;
          if (z) {
            cart = {
              source: 'zoppy',
              items: parseZoppyItems(z.line_items),
              total: typeof z.total === 'number' ? z.total : null,
              url: (z.url as string | null) ?? null,
              createdAt: (z.zoppy_created_at as string | null) ?? null,
            };
          }
        }
      }

      timeline.sort((a, b) => (a.at < b.at ? 1 : -1));
      return { cart, timeline };
    },
  });
}
