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

export type TrackedLinkSource = 'esteira_email' | 'esteira_whatsapp' | 'esteira_sms' | 'agente' | 'manual' | 'outro';

export interface CreateTrackedLinkOpts {
  destination: string;
  peopleId?: string | null;
  leadId?: string | null;
  channel?: string | null;
  /** Quem criou o link. Default 'outro' (legado). */
  source?: TrackedLinkSource;
  /** Slot: link_checkout | link_novo_checkout | wa_button_url | <nome da tool do agente>. */
  label?: string | null;
  /** Nome do template Meta / template de e-mail / subject do toque. */
  templateName?: string | null;
  followupQueueId?: string | null;
  messageId?: number | null;
  executionId?: string | null;
}

export interface TrackedLinkCreated { id: string; token: string; url: string }

/** Base pública do redirect. Domínio curto (decisão da cliente) entra por env sem tocar código. */
export function trackedLinkBaseUrl(): string {
  const custom = (Deno.env.get('TRACKED_LINK_BASE_URL') ?? '').trim().replace(/\/+$/, '');
  if (custom) return custom;
  return `${(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')}/functions/v1/r`;
}

/** Base terminada em "/r" → "?t=<token>" (formato dos templates Meta aprovados); senão "/<token>". */
export function buildTrackedUrl(base: string, token: string): string {
  const b = base.replace(/\/+$/, '');
  return b.endsWith('/r') ? `${b}?t=${token}` : `${b}/${token}`;
}

export async function createTrackedLinkDetailed(
  supabase: SupabaseClient,
  opts: CreateTrackedLinkOpts,
): Promise<TrackedLinkCreated | null> {
  if (!opts.destination || !/^https?:\/\//i.test(opts.destination)) return null;
  const token = shortToken();
  const { data, error } = await supabase.from('tracked_links').insert({
    token,
    destination: opts.destination,
    people_id: opts.peopleId ?? null,
    lead_id: opts.leadId ?? null,
    channel: opts.channel ?? null,
    source: opts.source ?? 'outro',
    label: opts.label ?? null,
    template_name: opts.templateName ?? null,
    followup_queue_id: opts.followupQueueId ?? null,
    message_id: opts.messageId ?? null,
    execution_id: opts.executionId ?? null,
  }).select('id').single();
  if (error || !data) return null;
  return { id: (data as { id: string }).id, token, url: buildTrackedUrl(trackedLinkBaseUrl(), token) };
}

/** Compat: devolve só a URL. Prefira createTrackedLinkDetailed quando precisar do token/id. */
export async function createTrackedLink(supabase: SupabaseClient, opts: CreateTrackedLinkOpts): Promise<string | null> {
  return (await createTrackedLinkDetailed(supabase, opts))?.url ?? null;
}

/** Liga o link à linha de `messages` criada depois dele (template WA, botão do agente). */
export async function attachTrackedLinkMessage(supabase: SupabaseClient, linkId: string, messageId: number): Promise<void> {
  await supabase.from('tracked_links').update({ message_id: messageId }).eq('id', linkId).is('message_id', null);
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

export interface PendingPayment {
  metodo: 'pix' | 'pix_parcelado' | 'boleto' | 'outro';
  orderId: string | null;
  numeroPedido: string | null;
  total: number | null;
  pixCodigo: string | null;
  pixExpira: Date | null;
  boletoUrl: string | null;
  boletoCodigo: string | null;
  boletoVencimento: string | null;
  /** Yampi reorder_url: recria o carrinho com os mesmos itens (novo Pix/cartão). */
  reorderUrl: string | null;
  pago: boolean;
  cancelado: boolean;
  criadoEm: Date | null;
}

/** Datas Yampi vêm "YYYY-MM-DD HH:mm:ss" em America/Sao_Paulo (UTC-3 fixo). */
export function parseYampiDate(v: unknown): Date | null {
  const raw = typeof v === 'string' ? v : (rec(v).date as string | undefined);
  if (!raw) return null;
  const ts = Date.parse(`${raw.replace(' ', 'T').slice(0, 19)}-03:00`);
  return Number.isFinite(ts) ? new Date(ts) : null;
}

/**
 * Último pagamento pendente (Pix/boleto) da pessoa, lido dos webhooks Yampi já
 * armazenados — não depende do escopo "Pedidos" da credencial. O payload do
 * order.created traz pix.data{pix_qr_code, pix_expiration_date}, transactions[]
 * (boleto) e reorder_url.
 */
export async function resolvePendingPaymentForPerson(
  supabase: SupabaseClient,
  peopleId: string,
): Promise<PendingPayment | null> {
  const { data: events } = await supabase
    .from('yampi_webhook_events')
    .select('order_id, trigger, raw_payload, created_at')
    .eq('people_id', peopleId)
    .in('trigger', ['pix_gerado', 'boleto_gerado', 'pedido_criado', 'pedido_pago', 'pedido_cancelado'])
    .order('created_at', { ascending: false })
    .limit(12);
  const evs = (events ?? []) as Array<{ order_id: string | null; trigger: string; raw_payload: AnyRec; created_at: string }>;
  const pend = evs.find((e) => ['pix_gerado', 'boleto_gerado', 'pedido_criado'].includes(e.trigger) && e.order_id);
  if (!pend) return null;
  const later = evs.filter((e) => e.order_id === pend.order_id && e.created_at > pend.created_at);
  const pago = later.some((e) => e.trigger === 'pedido_pago');
  const cancelado = !pago && later.some((e) => e.trigger === 'pedido_cancelado');
  const resource = rec(pend.raw_payload.resource);
  const pix = rec(rec(resource.pix).data);
  const txs = (rec(resource.transactions).data ?? []) as unknown;
  const tx = (Array.isArray(txs) ? txs.map(rec).find((t) => t.billet_url || t.pix_qr_code) ?? rec((txs as unknown[])[0]) : {}) as AnyRec;
  const alias = String(rec(rec(tx.payment).data).alias ?? (Array.isArray(resource.payments) ? rec((resource.payments as unknown[])[0]).alias : '') ?? '');
  const metodo: PendingPayment['metodo'] = alias === 'pix' ? 'pix' : alias === 'pix_in_installments' ? 'pix_parcelado' : alias === 'billet' ? 'boleto' : 'outro';
  return {
    metodo,
    orderId: pend.order_id,
    numeroPedido: resource.number != null ? String(resource.number) : null,
    total: typeof resource.value_total === 'number' ? resource.value_total : Number(resource.value_total) || null,
    pixCodigo: (pix.pix_qr_code as string | undefined) ?? (tx.pix_qr_code as string | undefined) ?? null,
    pixExpira: parseYampiDate(pix.pix_expiration_date ?? tx.pix_expiration_date),
    boletoUrl: (tx.billet_url as string | undefined) ?? null,
    boletoCodigo: (tx.billet_barcode as string | undefined) ?? null,
    boletoVencimento: typeof tx.billet_date === 'string' ? tx.billet_date : (rec(tx.billet_date).date as string | undefined) ?? null,
    reorderUrl: (resource.reorder_url as string | undefined) ?? null,
    pago,
    cancelado,
    criadoEm: parseYampiDate(resource.created_at) ?? new Date(pend.created_at),
  };
}

/** Link de recuperação mais recente da pessoa (atalho de resolveCartForPerson). */
export async function resolveCartUrlForPerson(
  supabase: SupabaseClient,
  peopleId: string,
): Promise<string | null> {
  return (await resolveCartForPerson(supabase, peopleId)).url;
}

export interface TrackedClickBefore { linkId: string; source: string; templateName: string | null; label: string | null; clickedAt: string }

/** Link nosso mais recentemente clicado (humano) pela pessoa antes de `before`, dentro da janela. */
export async function findTrackedClickBefore(
  supabase: SupabaseClient,
  peopleId: string,
  before: Date,
  windowDays: number,
): Promise<TrackedClickBefore | null> {
  const windowStart = new Date(before.getTime() - windowDays * 86_400_000).toISOString();
  const { data } = await supabase
    .from('tracked_links')
    .select('id, source, template_name, label, last_clicked_at')
    .eq('people_id', peopleId)
    .gt('clicks', 0)
    .gte('last_clicked_at', windowStart)
    .lte('last_clicked_at', before.toISOString())
    .order('last_clicked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const r = data as { id: string; source: string; template_name: string | null; label: string | null; last_clicked_at: string } | null;
  return r ? { linkId: r.id, source: r.source, templateName: r.template_name, label: r.label, clickedAt: r.last_clicked_at } : null;
}

/** true se a pessoa clicou em algum link rastreado nosso antes de `before`, dentro da janela. */
export async function hadTrackedClickBefore(supabase: SupabaseClient, peopleId: string, before: Date, windowDays: number): Promise<boolean> {
  return !!(await findTrackedClickBefore(supabase, peopleId, before, windowDays));
}
