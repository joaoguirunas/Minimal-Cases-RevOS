/**
 * _shared/esteira-coupon.ts — o cupom pessoal da esteira v2 (NOME15).
 *
 * Um cupom por pessoa: 15%, uso único, 7 dias. Nasce na Yampi imediatamente
 * antes do primeiro toque que o mostra e é reaproveitado por todos os seguintes
 * (WhatsApp, e-mail, toque de clique) com a MESMA validade — a mensagem nunca
 * promete um prazo que o cupom não tem.
 *
 * "Por pessoa" vale dentro de 30 dias: quem abandona outro carrinho meses depois
 * recebe um cupom novo. Cupom de 15% que o agente já deu pra pessoa nesse
 * período conta como o dela (não empilha dois descontos).
 *
 * Nunca devolve código que não exista na Yampi: se a criação falha, o toque
 * espera e tenta de novo (quem decide é o worker).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createYampiClientForConnection } from './yampi-client.ts';
import { createPersonalCoupon } from './yampi-coupon.ts';

export const ESTEIRA_COUPON_PERCENT = 15;
export const ESTEIRA_COUPON_DAYS = 7;
const REUSE_WINDOW_DAYS = 30;
/** Cupom que vence em menos que isso não é mostrado: a pessoa não teria tempo de usar. */
const MIN_REMAINING_MS = 2 * 3_600_000;

export type EsteiraCoupon =
  | { kind: 'ok'; code: string; expiresAt: string; created: boolean }
  | { kind: 'expired'; code: string }
  | { kind: 'error'; message: string };

interface CouponRow { code: string; expires_at: string | null }

/** Decide sobre um cupom já existente. Pura — testável. */
export function judgeExisting(row: CouponRow, now: Date): EsteiraCoupon {
  if (!row.expires_at) return { kind: 'expired', code: row.code };
  if (new Date(row.expires_at).getTime() - now.getTime() < MIN_REMAINING_MS) return { kind: 'expired', code: row.code };
  return { kind: 'ok', code: row.code, expiresAt: row.expires_at, created: false };
}

export async function ensureEsteiraCoupon(
  supabase: SupabaseClient,
  p: { peopleId: string; leadId: string | null; firstName: string },
  now = new Date(),
): Promise<EsteiraCoupon> {
  const since = new Date(now.getTime() - REUSE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('crm_coupons')
    .select('code, expires_at')
    .eq('people_id', p.peopleId)
    .eq('percent', ESTEIRA_COUPON_PERCENT)
    .in('source', ['esteira', 'agente'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { kind: 'error', message: `crm_coupons: ${error.message}` };
  if (data) return judgeExisting(data as CouponRow, now);

  try {
    const bound = await createYampiClientForConnection(supabase);
    if (!bound) return { kind: 'error', message: 'Yampi não conectada' };
    const c = await createPersonalCoupon(supabase, bound.client, {
      firstName: p.firstName || 'cliente',
      percent: ESTEIRA_COUPON_PERCENT,
      validityDays: ESTEIRA_COUPON_DAYS,
      peopleId: p.peopleId,
      leadId: p.leadId,
      source: 'esteira',
      createdBy: null,
      allowUnknownReuse: false,
    });
    if (!c.expiresAt) return { kind: 'error', message: `cupom ${c.code} sem validade conhecida` };
    return { kind: 'ok', code: c.code, expiresAt: c.expiresAt, created: !c.reused };
  } catch (e) {
    return { kind: 'error', message: `Yampi: ${(e as Error).message}`.slice(0, 300) };
  }
}

/** "29/09 às 14:30" no fuso da loja. */
export function formatExpiry(iso: string): string {
  return new Date(iso)
    .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(',', ' às');
}

/**
 * Põe as UTMs da esteira no destino, SOBRESCREVENDO as que vierem nele: o link
 * de carrinho da Yampi já nasce com utm_source=google&utm_campaign= (vazio), e
 * a venda seria atribuída ao Google.
 */
export function withEsteiraUtm(url: string, medium: 'whatsapp' | 'email', content: string): string {
  try {
    const u = new URL(url);
    const set = (k: string, v: string) => u.searchParams.set(k, v);
    set('utm_source', 'crm');
    set('utm_medium', medium);
    set('utm_campaign', 'carrinho-abandonado');
    set('utm_content', content);
    return u.toString();
  } catch (_) {
    return url;
  }
}
