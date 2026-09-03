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

export interface PersonCart {
  url: string | null;
  /** Título do produto sem o sufixo de modelo (ex.: "Case Anti Impacto … Azul"). */
  produto: string | null;
  /** Modelo do aparelho extraído da variante (ex.: "iPhone 17 Pro Max"). */
  modeloCelular: string | null;
  /** Versão curta (ex.: "iPhone 17"). */
  modeloCelularCurto: string | null;
  imagemProduto: string | null;
  total: number | null;
  itens: number;
  /** Yampi: id do SKU principal (guarda de estoque, troca de variante). */
  skuId: number | null;
  /** Yampi search.data.abandoned_step: personal_info | shippment | payment. */
  etapaAbandono: string | null;
  /** Yampi search.data.has_refused_payment. */
  pagamentoRecusado: boolean;
}

const MODEL_RE = /\b((?:iPhone|Galaxy|Samsung|Motorola|Moto|Xiaomi|Redmi|Poco|Pixel)\b[^,/|]*?)\s*$/i;

/** Separa "Case … Azul iPhone 17 Pro Max" em produto + modelo (best-effort). */
export function splitProductModel(title: string): { produto: string; modelo: string | null } {
  const m = title.match(MODEL_RE);
  if (!m) return { produto: title.trim(), modelo: null };
  const modelo = m[1].trim();
  const produto = title.slice(0, m.index).trim().replace(/[-–—]\s*$/, '').trim();
  return { produto: produto || title.trim(), modelo };
}

export function formatBRL(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Carrinho mais recente da pessoa com dados pra personalização dos templates:
 * link de recuperação (simulate_url com customerToken > unauth), produto, modelo,
 * imagem, total. Yampi (eventos carrinho_abandonado/checkout_iniciado) → Zoppy.
 */
export async function resolveCartForPerson(
  supabase: SupabaseClient,
  peopleId: string,
): Promise<PersonCart> {
  const empty: PersonCart = { url: null, produto: null, modeloCelular: null, modeloCelularCurto: null, imagemProduto: null, total: null, itens: 0, skuId: null, etapaAbandono: null, pagamentoRecusado: false };
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
    const itemsData = (rec(resource.items).data ?? resource.items) as unknown;
    const items = Array.isArray(itemsData) ? itemsData as Array<AnyRec> : [];
    if (!url && items.length === 0) continue;
    const first = rec(items[0]);
    const sku = rec(rec(first.sku).data);
    const title = String(sku.title ?? first.title ?? '').trim();
    const { produto, modelo } = title ? splitProductModel(title) : { produto: '', modelo: null };
    const imgs = (rec(sku.images).data ?? sku.images) as unknown;
    const img = Array.isArray(imgs) ? rec(imgs[0]) : {};
    const imagem = (img.url ?? img.src ?? img.large?.toString?.() ?? null) as string | null;
    const totalizers = rec(resource.totalizers);
    const total = typeof totalizers.total === 'number' ? totalizers.total
      : typeof resource.value_total === 'number' ? resource.value_total as number : null;
    const search = rec(rec(resource.search).data);
    return {
      url: url ?? null,
      produto: produto || null,
      modeloCelular: modelo,
      modeloCelularCurto: modelo ? modelo.split(/\s+/).slice(0, 2).join(' ') : null,
      imagemProduto: imagem,
      total,
      itens: items.length,
      skuId: typeof sku.id === 'number' ? sku.id : null,
      etapaAbandono: typeof search.abandoned_step === 'string' ? search.abandoned_step : null,
      pagamentoRecusado: search.has_refused_payment === true,
    };
  }
  const { data: zcart } = await supabase
    .from('zoppy_abandoned_carts')
    .select('url, total, line_items')
    .eq('people_id', peopleId)
    .order('zoppy_created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const z = zcart as { url: string | null; total: number | null; line_items: unknown } | null;
  if (!z) return empty;
  const li = Array.isArray(z.line_items) ? z.line_items as Array<AnyRec> : [];
  const zt = String(rec(rec(li[0]).product).name ?? rec(li[0]).name ?? '').trim();
  const { produto, modelo } = zt ? splitProductModel(zt) : { produto: '', modelo: null };
  return { ...empty, url: z.url, produto: produto || null, modeloCelular: modelo,
    modeloCelularCurto: modelo ? modelo.split(/\s+/).slice(0, 2).join(' ') : null, total: z.total, itens: li.length };
}

/** Link de recuperação mais recente da pessoa (atalho de resolveCartForPerson). */
export async function resolveCartUrlForPerson(
  supabase: SupabaseClient,
  peopleId: string,
): Promise<string | null> {
  return (await resolveCartForPerson(supabase, peopleId)).url;
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
