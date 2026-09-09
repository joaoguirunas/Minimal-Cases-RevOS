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

/**
 * Linha de `crm_coupons` do código: dono e validade REAL.
 * `YampiPromocode` não devolve `end_at`, então a validade de um cupom reaproveitado
 * só pode vir daqui — nunca de `now + validityDays`, que seria um chute.
 */
export interface CouponOwner { peopleId: string | null; expiresAt: string | null }

export interface PickCouponOpts {
  /** Pessoa pra quem o cupom está sendo gerado. */
  peopleId?: string | null;
  /** Consulta `crm_coupons` pelo código. Sem ela não há checagem de dono (só testes puros). */
  owner?: (code: string) => Promise<CouponOwner | null>;
}

export interface PickedCoupon {
  code: string;
  reused: boolean;
  /** Validade real do cupom reaproveitado (de `crm_coupons`). `null` quando novo ou desconhecida. */
  expiresAt: string | null;
}

/**
 * Decide o código: reaproveita o base se ativo E do mesmo cliente, senão tenta X2..X9.
 * `find` consulta a Yampi; `opts.owner` consulta o CRM.
 *
 * Colisão de primeiro nome é o caso perigoso: "ANA10" ativo pode ser da Ana Paula, não da
 * Ana Clara. Reaproveitar entregaria à segunda um cupom de uso único que a primeira já pode
 * ter queimado — e com validade errada. Por isso só reaproveitamos quando o CRM confirma a
 * mesma `people_id`. Código ativo que o CRM não conhece (cupom criado à mão na Yampi, ou
 * anterior a esta tabela) mantém o comportamento antigo: reaproveita.
 */
export async function pickCouponCode(
  firstName: string, percent: number, find: (code: string) => Promise<Existing>,
  opts: PickCouponOpts = {},
): Promise<PickedCoupon> {
  const base = buildCouponCode(firstName, percent);
  const usable = async (code: string, allowUnknown: boolean): Promise<CouponOwner | null | false> => {
    const row = opts.owner ? await opts.owner(code) : null;
    if (!row) return allowUnknown ? null : false;
    return opts.peopleId != null && row.peopleId === opts.peopleId ? row : false;
  };

  const existing = await find(base);
  if (!existing) return { code: base, reused: false, expiresAt: null };
  if (existing.active && !existing.expired) {
    const row = await usable(base, true);
    if (row !== false) return { code: base, reused: true, expiresAt: row?.expiresAt ?? null };
  }
  for (let n = 2; n <= 9; n++) {
    const candidate = `${base}X${n}`.slice(0, 20);
    const found = await find(candidate);
    if (!found) return { code: candidate, reused: false, expiresAt: null };
    // Sufixo ativo só volta pro mesmo cliente: um XN que o CRM não conhece nunca foi nosso.
    if (found.active && !found.expired) {
      const row = await usable(candidate, false);
      if (row) return { code: candidate, reused: true, expiresAt: row.expiresAt };
    }
  }
  return { code: `${base}X9`.slice(0, 20), reused: false, expiresAt: null };
}

export interface CreateCouponOpts {
  firstName: string; percent: number; validityDays: number; freeShipping?: boolean;
  peopleId: string | null; leadId: string | null;
  source: 'agente' | 'comercial'; createdBy: string | null;
}

/**
 * União discriminada: cupom novo sempre tem validade; reaproveitado só tem se o CRM souber.
 * `if (r.reused) …` estreita o tipo, então o caminho "novo" continua com `expiresAt: string`.
 */
export type CouponCreated =
  | { code: string; percent: number; expiresAt: string; reused: false }
  | { code: string; percent: number; expiresAt: string | null; reused: true };

/** Dono/validade do código no CRM. Erro de banco PROPAGA — sem isso não dá pra decidir reaproveitar. */
async function couponOwnerFromDb(supabase: SupabaseClient, code: string): Promise<CouponOwner | null> {
  const { data, error } = await supabase.from('crm_coupons')
    .select('people_id, expires_at').eq('code', code).maybeSingle();
  if (error) throw new Error(`crm_coupons indisponível (${error.message})`);
  if (!data) return null;
  const row = data as { people_id: string | null; expires_at: string | null };
  return { peopleId: row.people_id, expiresAt: row.expires_at };
}

const fmtYampi = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

export async function createPersonalCoupon(
  supabase: SupabaseClient, client: YampiApiClient, opts: CreateCouponOpts,
): Promise<CouponCreated> {
  const dias = Math.min(Math.max(Math.floor(opts.validityDays) || 2, 1), 7);
  const picked = await pickCouponCode(opts.firstName, opts.percent, (c) => client.findPromocode(c), {
    peopleId: opts.peopleId,
    owner: (c) => couponOwnerFromDb(supabase, c),
  });
  const { code, reused } = picked;
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
  if (reused) return { code, percent: opts.percent, expiresAt: picked.expiresAt, reused: true };
  return { code, percent: opts.percent, expiresAt: end.toISOString(), reused: false };
}
