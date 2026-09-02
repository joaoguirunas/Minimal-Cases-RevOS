/**
 * yampi-events — pure helpers for yampi-process-event / yampi-reconcile (YMP-4).
 *
 * Side-effect free (no Supabase/network) so precedence ranking and payload
 * normalization are unit-testable in isolation. Mirrors _shared/kiwify-events.ts.
 */

export const YAMPI_TRIGGERS = [
  'checkout_iniciado',
  'carrinho_abandonado',
  'pix_gerado',
  'boleto_gerado',
  'pedido_criado',
  'pagamento_recusado',
  'pedido_pago',
  'pedido_cancelado',
  'pedido_status_atualizado',
] as const;
export type YampiTrigger = (typeof YAMPI_TRIGGERS)[number];

const TRIGGER_SET = new Set<string>(YAMPI_TRIGGERS);

export function isYampiTrigger(v: unknown): v is YampiTrigger {
  return typeof v === 'string' && TRIGGER_SET.has(v);
}

/**
 * Lifecycle rank — a later-arriving event whose rank is LOWER than what was already
 * processed for the same order/cart must not regress the lead's stage.
 * pedido_status_atualizado shares the "created" rank: it only moves the lead when a
 * mapping is explicitly configured, and never past a payment/cancellation.
 */
export const PRECEDENCE_RANK: Record<YampiTrigger, number> = {
  checkout_iniciado: 0,
  carrinho_abandonado: 1,
  pix_gerado: 2,
  boleto_gerado: 2,
  pedido_criado: 2,
  pedido_status_atualizado: 2,
  pagamento_recusado: 3,
  pedido_pago: 4,
  pedido_cancelado: 5,
};

export function rankOf(trigger: YampiTrigger | null): number {
  return trigger ? PRECEDENCE_RANK[trigger] : -1;
}

/**
 * Precedence decision vs. the last processed event of the same order/cart.
 * Proceed when strictly more advanced, or same rank but strictly newer.
 */
export function shouldProceed(
  incomingRank: number,
  incomingTs: number | null,
  lastRank: number | null,
  lastTs: number | null,
): boolean {
  if (lastRank === null) return true;
  if (incomingRank > lastRank) return true;
  if (incomingRank < lastRank) return false;
  if (incomingTs !== null && lastTs !== null) return incomingTs > lastTs;
  return false;
}

// ── Payload normalization ─────────────────────────────────────────────────────

type AnyRec = Record<string, unknown>;

function asRecord(v: unknown): AnyRec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRec) : null;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface NormalizedYampiEvent {
  orderId: string | null;
  orderNumber: string | null;
  cartToken: string | null;
  customerName: string | null;
  customerFirstName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Cart/order total in reais (float), or null. */
  total: number | null;
  /** First items' titles (up to 4), for the lead title. */
  itemTitles: string[];
  /** Payload timestamp in epoch ms (webhook `time` / resource dates), or null. */
  eventTs: number | null;
  /** Cupom usado no pedido (include promocode), quando presente no payload. */
  couponCode: string | null;
}

/**
 * Normalizes a stored yampi_webhook_events.raw_payload — shape:
 *   { event, time, merchant, resource: { ...cart|order } }
 * Cart resources nest customer under customer.data (or tracking_data quando anônimo);
 * order resources idem. Tolerante a ambos.
 */
export function parseYampiPayload(raw: AnyRec): NormalizedYampiEvent {
  const resource = asRecord(raw.resource) ?? {};
  const customer = asRecord(asRecord(resource.customer)?.data) ?? asRecord(resource.customer) ?? {};
  const tracking = asRecord(resource.tracking_data) ?? {};
  const totalizers = asRecord(resource.totalizers) ?? {};
  const phoneObj = asRecord(customer.phone) ?? {};

  const name = asString(customer.name) ?? asString((customer as AnyRec).full_name) ?? asString(tracking.name);
  const email = (asString(customer.email) ?? asString(tracking.email))?.toLowerCase() ?? null;
  const phone = asString(phoneObj.full_number) ?? asString(phoneObj.number) ?? asString(tracking.phone);

  const itemsData = (asRecord(resource.items)?.data ?? resource.items) as unknown;
  const itemTitles: string[] = [];
  if (Array.isArray(itemsData)) {
    for (const it of itemsData.slice(0, 4)) {
      const sku = asRecord(asRecord(asRecord(it)?.sku)?.data);
      const title = asString(sku?.title) ?? asString(asRecord(it)?.title);
      if (title) itemTitles.push(title);
    }
  }

  const tsRaw = asString(raw.time) ?? asString(resource.updated_at) ?? asString(resource.created_at) ??
    asString(asRecord(resource.updated_at)?.date) ?? asString(asRecord(resource.created_at)?.date);
  const tsParsed = tsRaw ? Date.parse(tsRaw.replace(' ', 'T')) : NaN;

  const promo = asRecord(asRecord(resource.promocode)?.data) ?? asRecord(resource.promocode);
  const couponCode = asString(promo?.code) ?? asString(resource.coupon_code) ?? asString(resource.promocode_code);

  return {
    couponCode: couponCode ? couponCode.toUpperCase() : null,
    orderId: asString(resource.id),
    orderNumber: asString(resource.number),
    cartToken: asString(resource.token),
    customerName: name,
    customerFirstName: name ? name.split(/\s+/)[0] : null,
    customerEmail: email,
    customerPhone: phone,
    total: asNumber(totalizers.total) ?? asNumber(resource.value_total),
    itemTitles,
    eventTs: Number.isFinite(tsParsed) ? tsParsed : null,
  };
}

/**
 * Scope key for the precedence guard: order events guard by order_id; checkout/cart
 * events guard by cart_token (o mesmo carrinho gera checkout_iniciado e depois
 * carrinho_abandonado). Returns [column, value] or null when unguarded.
 */
export function guardScope(
  event: { order_id: string | null; cart_token: string | null },
): { column: 'order_id' | 'cart_token'; value: string } | null {
  if (event.order_id) return { column: 'order_id', value: event.order_id };
  if (event.cart_token) return { column: 'cart_token', value: event.cart_token };
  return null;
}
