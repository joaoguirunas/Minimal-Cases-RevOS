/**
 * _shared/yampi-coupon.ts — cupom pessoal de uso único na Yampi (agente e comercial).
 * Extraído do case `yampi_criar_cupom` do ai-agent-execute; comportamento do agente preservado.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { YampiApiClient, YampiPromocode } from './yampi-client.ts';

export const COUPON_PERCENTS_AGENT = [5, 10, 15] as const;
export const COUPON_PERCENTS_COMMERCIAL = [5, 10, 15, 20] as const;

export function buildCouponCode(firstName: string, percent: number): string {
  const first = (firstName ?? '').trim().split(/\s+/)[0] ?? '';
  const ascii = first.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'CLIENTE';
  return `${ascii}${percent}`.slice(0, 20);
}

type Existing = Pick<YampiPromocode, 'active' | 'expired' | 'value'> | null;

/** Decide o código: reaproveita o base se ativo, senão tenta X2..X9. `find` consulta a Yampi. */
export async function pickCouponCode(
  firstName: string, percent: number, find: (code: string) => Promise<Existing>,
): Promise<{ code: string; reused: boolean }> {
  const base = buildCouponCode(firstName, percent);
  const existing = await find(base);
  if (!existing) return { code: base, reused: false };
  if (existing.active && !existing.expired) return { code: base, reused: true };
  for (let n = 2; n <= 9; n++) {
    const candidate = `${base}X${n}`.slice(0, 20);
    if (!(await find(candidate))) return { code: candidate, reused: false };
  }
  return { code: `${base}X9`.slice(0, 20), reused: false };
}

export interface CreateCouponOpts {
  firstName: string; percent: number; validityDays: number; freeShipping?: boolean;
  peopleId: string | null; leadId: string | null;
  source: 'agente' | 'comercial'; createdBy: string | null;
}
export interface CouponCreated { code: string; percent: number; expiresAt: string; reused: boolean }

const fmtYampi = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

export async function createPersonalCoupon(
  supabase: SupabaseClient, client: YampiApiClient, opts: CreateCouponOpts,
): Promise<CouponCreated> {
  const dias = Math.min(Math.max(Math.floor(opts.validityDays) || 2, 1), 7);
  const { code, reused } = await pickCouponCode(opts.firstName, opts.percent, (c) => client.findPromocode(c));
  const now = new Date();
  const end = new Date(now.getTime() + dias * 24 * 3600_000);
  if (!reused) {
    await client.createPromocode({
      code, discount_type: 'p', value: opts.percent, quantity: 1,
      min_value: 0, // obrigatório na Yampi (422 sem ele)
      once_per_customer: true, accumulate: false, free_shipment: opts.freeShipping === true,
      abandoned_cart: false, active: true, start_at: fmtYampi(now), end_at: fmtYampi(end),
    });
  }
  await supabase.from('crm_coupons').upsert(
    { code, source: opts.source, people_id: opts.peopleId, lead_id: opts.leadId, percent: opts.percent,
      created_by: opts.createdBy, expires_at: reused ? undefined : end.toISOString() },
    { onConflict: 'code', ignoreDuplicates: true },
  );
  return { code, percent: opts.percent, expiresAt: end.toISOString(), reused };
}
