// supabase/functions/_shared/yampi-order-parse.ts
/**
 * Pedido da Yampi (webhook `resource` ou GET /orders com include) → linhas do BI.
 * Puro: sem banco, sem rede. As datas da Yampi vêm em São Paulo sem fuso.
 */
export interface OrderRow { id: number; number: string | null; customer_yampi_id: number | null; customer_email: string | null; customer_phone: string | null; status: string; is_paid: boolean; created_at: string; paid_at: string | null; cancelled_at: string | null; shipped_at: string | null; delivered_at: string | null; value_products: number; value_discount: number; value_shipment: number; value_total: number; payment_method: string | null; installments: number | null; coupon_code: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null; device: string | null; state: string | null; city: string | null; shipment_service: string | null; yampi_updated_at: string | null; raw: unknown }
export interface OrderItemRow { id: number; order_id: number; sku_id: number | null; product_id: number | null; sku: string | null; title: string | null; variant: string | null; quantity: number; price: number; total: number }

type R = Record<string, unknown>;
const rec = (v: unknown): R | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as R : null);
const arr = (v: unknown): unknown[] => { const d = rec(v)?.data ?? v; return Array.isArray(d) ? d : []; };
const one = (v: unknown): R | null => { const d = rec(v)?.data ?? v; return rec(d); };
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const int = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };

export function yampiDate(v: unknown): string | null {
  const s = str(rec(v)?.date ?? v);
  if (!s) return null;
  const iso = s.replace(' ', 'T').replace(/\.\d+$/, '');
  const t = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}-03:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

const PAID = new Set(['paid', 'authorized', 'invoiced', 'shipped', 'on_carriage', 'delivered', 'handling_products']);
function normStatus(alias: string | null): string {
  switch (alias) {
    case 'paid': case 'authorized': case 'invoiced': case 'handling_products': return 'paid';
    case 'shipped': case 'on_carriage': return 'shipped';
    case 'delivered': return 'delivered';
    case 'waiting_payment': case 'pending': return 'waiting_payment';
    case 'cancelled': case 'canceled': return 'cancelled';
    case 'refused': case 'payment_refused': return 'refused';
    case 'refunded': case 'chargeback': return 'refunded';
    default: return 'other';
  }
}
function paymentMethod(o: R): string | null {
  const tx = arr(o.transactions).map(rec).filter(Boolean) as R[];
  const pay = one((tx.find((t) => t.status === 'paid' || t.authorized === true) ?? tx[0])?.payment);
  if (pay) {
    if (pay.is_pix_in_installments) return 'pix_parcelado';
    if (pay.is_pix) return 'pix';
    if (pay.is_billet) return 'billet';
    if (pay.is_credit_card) return 'credit_card';
    if (pay.is_wallet) return 'wallet';
  }
  const alias = str(rec((o.payments as unknown[] | undefined)?.[0])?.alias);
  if (alias === 'pix' || alias === 'billet' || alias === 'credit_card') return alias;
  return alias ? 'other' : null;
}

export function parseYampiOrder(o: R): { order: OrderRow; items: OrderItemRow[] } | null {
  const id = int(o.id);
  if (!id) return null;
  const statusAlias = str(one(o.status)?.alias);
  const history = arr(o.statuses).map(rec).filter(Boolean) as R[];
  const firstAt = (aliases: string[]) => {
    const hit = history.filter((h) => aliases.includes(String(h.alias))).map((h) => yampiDate(h.created_at)).filter(Boolean).sort();
    return hit[0] ?? null;
  };
  const paidAt = firstAt([...PAID]);
  const status = normStatus(statusAlias);
  const cust = one(o.customer);
  const phone = rec(cust?.phone);
  const addr = one(o.shipping_address);
  const tx = arr(o.transactions).map(rec).filter(Boolean) as R[];
  const approved = tx.find((t) => t.status === 'paid' || t.authorized === true);
  const promo = one(o.promocode);

  const order: OrderRow = {
    id,
    number: str(o.number),
    customer_yampi_id: int(o.customer_id ?? cust?.id),
    customer_email: str(cust?.email)?.toLowerCase() ?? null,
    customer_phone: str(phone?.full_number),
    status,
    is_paid: !!paidAt || PAID.has(String(statusAlias)),
    created_at: yampiDate(o.created_at) ?? new Date().toISOString(),
    paid_at: paidAt ?? (PAID.has(String(statusAlias)) ? yampiDate(o.updated_at) : null),
    cancelled_at: firstAt(['cancelled', 'canceled', 'refunded', 'chargeback']),
    shipped_at: firstAt(['shipped', 'on_carriage']),
    delivered_at: firstAt(['delivered']),
    value_products: num(o.value_products),
    value_discount: num(o.value_discount),
    value_shipment: num(o.value_shipment),
    value_total: num(o.value_total),
    payment_method: paymentMethod(o),
    installments: int(approved?.installments),
    coupon_code: str(promo?.code)?.toUpperCase() ?? null,
    utm_source: str(o.utm_source), utm_medium: str(o.utm_medium), utm_campaign: str(o.utm_campaign),
    utm_content: str(o.utm_content), utm_term: str(o.utm_term),
    device: str(o.device),
    state: str(addr?.uf ?? addr?.state),
    city: str(addr?.city),
    shipment_service: str(o.shipment_service),
    yampi_updated_at: yampiDate(o.updated_at),
    raw: o,
  };
  const items: OrderItemRow[] = (arr(o.items).map(rec).filter(Boolean) as R[]).map((it) => {
    const sku = one(it.sku);
    const variations = Array.isArray(sku?.variations) ? (sku!.variations as R[]).map((v) => str(v.value)).filter(Boolean) : [];
    const quantity = int(it.quantity) ?? 1;
    const price = num(it.price);
    return {
      id: int(it.id) ?? 0, order_id: id,
      sku_id: int(it.sku_id ?? sku?.id), product_id: int(it.product_id ?? sku?.product_id),
      sku: str(it.item_sku ?? sku?.sku), title: str(sku?.title ?? it.title),
      variant: variations.length ? variations.join(' / ') : null,
      quantity, price, total: Math.round(price * quantity * 100) / 100,
    };
  }).filter((i) => i.id !== 0);
  return { order, items };
}
