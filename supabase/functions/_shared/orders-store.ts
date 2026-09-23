// supabase/functions/_shared/orders-store.ts
/**
 * Grava pedidos da Yampi em orders/order_items (upsert por id) e dispara a
 * atribuição. Usado pelo webhook (1 pedido) e pelo backfill (lote de 100).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseYampiOrder, type OrderItemRow } from './yampi-order-parse.ts';

const digits = (s: string | null) => (s ?? '').replace(/\D/g, '');
/** Telefone do CRM: 55 + DDD + número (13 dígitos); aceita as variações com/sem 55 e 9º dígito. */
function phoneKeys(p: string | null): string[] {
  const d = digits(p).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length < 10) return [];
  const with9 = d.length === 10 ? d.slice(0, 2) + '9' + d.slice(2) : d;
  return [...new Set([with9, `55${with9}`, d, `55${d}`])];
}

async function resolvePeople(sb: SupabaseClient, emails: string[], phones: string[]): Promise<{ byEmail: Map<string, string>; byPhone: Map<string, string> }> {
  const byEmail = new Map<string, string>(); const byPhone = new Map<string, string>();
  if (emails.length) {
    const { data } = await sb.from('clients_people').select('id, email, merged_into_id, status').in('email', emails);
    for (const p of (data ?? []) as any[]) byEmail.set(String(p.email).toLowerCase(), p.status === 'merged' && p.merged_into_id ? p.merged_into_id : p.id);
  }
  if (phones.length) {
    const { data } = await sb.from('clients_people').select('id, whatsapp, merged_into_id, status').in('whatsapp', phones);
    for (const p of (data ?? []) as any[]) byPhone.set(String(p.whatsapp), p.status === 'merged' && p.merged_into_id ? p.merged_into_id : p.id);
  }
  return { byEmail, byPhone };
}

export async function upsertYampiOrdersBatch(sb: SupabaseClient, resources: Record<string, unknown>[], attribute = true): Promise<number> {
  const all = resources.map(parseYampiOrder).filter(Boolean) as NonNullable<ReturnType<typeof parseYampiOrder>>[];
  if (!all.length) return 0;
  // Webhooks chegam fora de ordem (e há reprocesso): um snapshot mais velho que o
  // gravado não pode sobrescrever — senão um cancelado voltaria a "pago".
  const { data: stored } = await sb.from('orders').select('id, yampi_updated_at').in('id', all.map((p) => p.order.id));
  const storedAt = new Map(((stored ?? []) as { id: number; yampi_updated_at: string | null }[]).map((r) => [Number(r.id), r.yampi_updated_at]));
  const parsed = all.filter(({ order }) => {
    const prev = storedAt.get(order.id);
    return !prev || !order.yampi_updated_at || new Date(order.yampi_updated_at) >= new Date(prev);
  });
  if (!parsed.length) return 0;
  const emails = [...new Set(parsed.map((p) => p.order.customer_email).filter(Boolean) as string[])];
  const phones = [...new Set(parsed.flatMap((p) => phoneKeys(p.order.customer_phone)))];
  const { byEmail, byPhone } = await resolvePeople(sb, emails, phones);

  const orders = parsed.map(({ order }) => ({
    ...order,
    people_id: (order.customer_email && byEmail.get(order.customer_email))
      || phoneKeys(order.customer_phone).map((k) => byPhone.get(k)).find(Boolean) || null,
    synced_at: new Date().toISOString(),
  }));
  const { error } = await sb.from('orders').upsert(orders, { onConflict: 'id' });
  if (error) throw new Error(`orders upsert: ${error.message}`);

  const ids = parsed.map((p) => p.order.id);
  await sb.from('order_items').delete().in('order_id', ids);
  const items: OrderItemRow[] = parsed.flatMap((p) => p.items);
  if (items.length) {
    const { error: e2 } = await sb.from('order_items').upsert(items, { onConflict: 'id' });
    if (e2) throw new Error(`order_items upsert: ${e2.message}`);
  }
  if (attribute) {
    for (const o of orders) if (o.is_paid) await sb.rpc('compute_order_attribution_and_first', { p_order_id: o.id }).then(() => {}, () => {});
  }
  return orders.length;
}

export async function upsertYampiOrder(sb: SupabaseClient, resource: Record<string, unknown>, opts: { attribute?: boolean } = {}) {
  const n = await upsertYampiOrdersBatch(sb, [resource], opts.attribute !== false);
  if (!n) return null;
  const { data } = await sb.from('orders').select('id, people_id').eq('id', Number(resource.id)).maybeSingle();
  return (data as { id: number; people_id: string | null } | null) ?? null;
}
