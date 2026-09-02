/**
 * _shared/tracked-links.ts — links curtos rastreados (BI-REC-3).
 *
 * createTrackedLink() grava o destino em tracked_links e devolve a URL curta
 * (edge function pública `r`): {SUPABASE_URL}/functions/v1/r?t=<token>.
 * Cada clique incrementa `clicks` e carimba first/last_clicked_at — evidência
 * de engajamento usada na atribuição de reconversão (nível 'clique').
 *
 * resolveCartUrlForPerson() acha o link de recuperação mais recente da pessoa
 * (evento Yampi → fallback Zoppy) para injetar {{link_checkout}} nos follow-ups.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function shortToken(len = 10): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export async function createTrackedLink(
  supabase: SupabaseClient,
  opts: { destination: string; peopleId?: string | null; leadId?: string | null; channel?: string | null },
): Promise<string | null> {
  if (!opts.destination || !/^https?:\/\//i.test(opts.destination)) return null;
  const token = shortToken();
  const { error } = await supabase.from('tracked_links').insert({
    token,
    destination: opts.destination,
    people_id: opts.peopleId ?? null,
    lead_id: opts.leadId ?? null,
    channel: opts.channel ?? null,
  });
  if (error) return null;
  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  return `${base}/functions/v1/r?t=${token}`;
}

type AnyRec = Record<string, unknown>;
const rec = (v: unknown): AnyRec => (v && typeof v === 'object' && !Array.isArray(v) ? v as AnyRec : {});

/** Link de recuperação mais recente da pessoa: carrinho Yampi → fallback Zoppy. */
export async function resolveCartUrlForPerson(
  supabase: SupabaseClient,
  peopleId: string,
): Promise<string | null> {
  const { data: events } = await supabase
    .from('yampi_webhook_events')
    .select('raw_payload')
    .eq('people_id', peopleId)
    .in('trigger', ['carrinho_abandonado', 'checkout_iniciado'])
    .order('created_at', { ascending: false })
    .limit(3);
  for (const ev of (events ?? []) as Array<AnyRec>) {
    const resource = rec(rec(ev.raw_payload).resource);
    // simulate_url primeiro: carrinho preso a conta de cliente só restaura com o
    // customerToken; a unauth (forceLogout=1) faz a Yampi devolver carrinho vazio.
    const url = (resource.simulate_url ?? resource.unauth_simulate_url) as string | undefined;
    if (url) return url;
  }
  const { data: zcart } = await supabase
    .from('zoppy_abandoned_carts')
    .select('url')
    .eq('people_id', peopleId)
    .order('zoppy_created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((zcart as { url: string | null } | null)?.url) ?? null;
}

/** true se a pessoa clicou em algum link rastreado nosso antes de `before`, dentro da janela. */
export async function hadTrackedClickBefore(
  supabase: SupabaseClient,
  peopleId: string,
  before: Date,
  windowDays: number,
): Promise<boolean> {
  const windowStart = new Date(before.getTime() - windowDays * 86_400_000).toISOString();
  const { data } = await supabase
    .from('tracked_links')
    .select('id')
    .eq('people_id', peopleId)
    .gt('clicks', 0)
    .gte('last_clicked_at', windowStart)
    .lte('last_clicked_at', before.toISOString())
    .limit(1)
    .maybeSingle();
  return !!data;
}
