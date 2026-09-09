/** Atribuição HUMANA do pedido pago (spec §3.3): cupom do comercial > carrinho dele pago em ≤7d de claimed_at. */
export interface HumanAttributionInput {
  couponCreatedBy: string | null;
  leadUserId: string | null;
  leadClaimedAt: string | null;
  paidAt: Date;
  windowDays?: number;
}

export function decideHumanAttribution(i: HumanAttributionInput): { recoveredBy: string | null; basis: 'cupom' | 'janela' | null } {
  if (i.couponCreatedBy) return { recoveredBy: i.couponCreatedBy, basis: 'cupom' };
  if (i.leadUserId && i.leadClaimedAt) {
    const limit = new Date(i.leadClaimedAt).getTime() + (i.windowDays ?? 7) * 86_400_000;
    if (Number.isFinite(limit) && i.paidAt.getTime() <= limit) return { recoveredBy: i.leadUserId, basis: 'janela' };
  }
  return { recoveredBy: null, basis: null };
}

export function commissionValue(total: number | null, pct: number | null): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  return Math.round(total * ((pct ?? 0) / 100) * 100) / 100;
}

/** Primeiro SKU do carrinho/pedido (payload Yampi): resource.items(.data)[0].sku.data.id. */
export function extractFirstSkuId(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const resource = (raw as Record<string, unknown>).resource;
  if (!resource || typeof resource !== 'object') return null;
  const items = (resource as Record<string, unknown>).items;
  let list: unknown[];
  if (items && typeof items === 'object' && Array.isArray((items as Record<string, unknown>).data)) {
    list = (items as Record<string, unknown>).data as unknown[];
  } else if (Array.isArray(items)) {
    list = items;
  } else {
    return null;
  }

  const first = list[0];
  if (!first || typeof first !== 'object') return null;
  const sku = (first as Record<string, unknown>).sku;
  if (!sku || typeof sku !== 'object') return null;
  const skuData = (sku as Record<string, unknown>).data;
  if (!skuData || typeof skuData !== 'object') return null;
  const id = (skuData as Record<string, unknown>).id;

  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  return null;
}
