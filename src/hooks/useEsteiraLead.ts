/**
 * useEsteiraLead — dados da esteira de recuperação para cards e página do lead (EST-UI).
 *
 *  - useLeadEsteira: carrinho (Yampi events → fallback Zoppy) + timeline unificada
 *    (eventos da loja + toques da esteira com nome do template/assunto).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeQueue, type LeadQueueSummary, type QueueRow } from '@/lib/esteira/queueSummary';

// Tabelas yampi_*/zoppy_* ainda não estão nos types gerados.
const db = supabase as unknown as SupabaseClient;

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
  image: string | null;
  variations: Array<{ name: string; value: string }>;
  etapaAbandono: 'cadastro' | 'frete' | 'pagamento' | null;
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
  templateName?: string | null;
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

const ABANDONED_STEP: Record<string, 'cadastro' | 'frete' | 'pagamento'> = {
  personal_info: 'cadastro',
  shippment: 'frete',
  payment: 'pagamento',
};

function parseYampiCart(raw: AnyRec): {
  items: CartItem[]; total: number | null; url: string | null;
  image: string | null; variations: Array<{ name: string; value: string }>;
  etapaAbandono: 'cadastro' | 'frete' | 'pagamento' | null;
} {
  const resource = rec(raw.resource);
  const itemsData = (rec(resource.items).data ?? resource.items) as unknown;
  const items: CartItem[] = [];
  let image: string | null = null;
  let variations: Array<{ name: string; value: string }> = [];
  if (Array.isArray(itemsData)) {
    itemsData.forEach((it, idx) => {
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
      if (idx === 0) {
        const skuImages = rec(sku.images);
        const firstImage = Array.isArray(skuImages.data) ? rec(skuImages.data[0]) : {};
        const imgUrl = (firstImage.url ?? firstImage.src) as string | undefined;
        image = typeof imgUrl === 'string' ? imgUrl : null;
        const rawVariations = Array.isArray(sku.variations) ? sku.variations : [];
        variations = rawVariations
          .map((v) => rec(v))
          .filter((v) => typeof v.name === 'string' && typeof v.value === 'string')
          .map((v) => ({ name: String(v.name), value: String(v.value) }));
      }
    });
  }
  const totalizers = rec(resource.totalizers);
  const total = typeof totalizers.total === 'number' ? totalizers.total
    : typeof resource.value_total === 'number' ? resource.value_total as number : null;
  // simulate_url primeiro: carrinho de cliente logado só restaura com o
  // customerToken — a versão unauth (forceLogout=1) derruba a sessão e a Yampi
  // devolve carrinho vazio (caso Ari Chaves). Pra convidado, ambas funcionam.
  const url = (resource.simulate_url ?? resource.unauth_simulate_url ?? null) as string | null;
  const abandonedStepRaw = rec(resource.search).data;
  const abandonedStep = rec(abandonedStepRaw).abandoned_step as string | undefined;
  const etapaAbandono = abandonedStep ? (ABANDONED_STEP[abandonedStep] ?? null) : null;
  return { items, total, url, image, variations, etapaAbandono };
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

export const CHANNEL_TITLES: Record<string, string> = {
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
          templateName: tplName ?? null,
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
              image: null,
              variations: [],
              etapaAbandono: null,
            };
          }
        }
      }

      timeline.sort((a, b) => (a.at < b.at ? 1 : -1));
      return { cart, timeline };
    },
  });
}

/**
 * Cancela (pausa) os toques pendentes de um lead na esteira.
 *
 * A policy `fup_queue_write` do `followup_queue` usa um USING independente
 * da linha (super_admin OU user_type IN admin/manager) — pra quem não tem
 * a role, o UPDATE não dá erro, só casa zero linhas (error: null, count: 0).
 * Por isso o mutationFn recebe `expected` (quantos toques deveriam ser
 * cancelados) e lança um erro sentinela quando count fica 0 mas era esperado
 * >0, pra distinguir "negado por RLS" de "não havia nada pendente".
 */
export function useCancelPendingTouches(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expected: number) => {
      const { error, count } = await db.from('followup_queue')
        .update({ status: 'cancelled', error_message: 'cancelado pelo operador' }, { count: 'exact' })
        .eq('lead_id', leadId).eq('status', 'pending');
      if (error) throw error;
      if ((count ?? 0) === 0 && expected > 0) throw new Error('SEM_PERMISSAO');
      return count ?? 0;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['esteira'] }),
  });
}
