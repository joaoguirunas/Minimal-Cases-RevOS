/**
 * _shared/yampi-product.ts — resumo do produto do carrinho pro agente (AGENTE-PRODUTO).
 *
 * `summarizeProduct` é pura e defensiva: aceita tanto o formato "wrapped"
 * (`{ data: {...} }`, listas como `{ data: [...] }`) quanto arrays/objetos
 * diretos — a Yampi devolve os dois formatos dependendo do endpoint/include.
 *
 * `resolveProductSummary` busca com cache (yampi_products_cache, TTL 24h);
 * nunca lança — qualquer falha de rede/API cai pro cache velho, ou null.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { formatBRL } from './tracked-links.ts';

export interface ProductSummary {
  id: number;
  nome: string;
  marca: string | null;
  descricao: string;
  categorias: string[];
  cores: string[];
  modelos: string[];
  precoMin: number | null;
  precoMax: number | null;
  variantes: number;
  semEstoque: string[];
  imagem: string | null;
  variantesDetalhe: Array<{
    skuId: number;
    titulo: string;
    cor: string | null;
    modelo: string | null;
    preco: number | null;
    emEstoque: boolean;
  }>;
}

type AnyRec = Record<string, unknown>;

/** Aceita `{ data: {...} }` ou o objeto direto. */
function rec(v: unknown): AnyRec {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const d = (v as AnyRec).data;
    if (d && typeof d === 'object' && !Array.isArray(d)) return d as AnyRec;
    return v as AnyRec;
  }
  return {};
}

/** Aceita `{ data: [...] }` ou o array direto. */
function list(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const d = (v as AnyRec).data;
    if (Array.isArray(d)) return d;
  }
  return [];
}

const COLOR_RE = /cor|color/i;
const MODEL_RE = /modelo|aparelho|celular|compat/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

/** Decodifica `&amp; &lt; &gt; &quot; &#39; &apos; &nbsp;` e numéricas (`&#NNN;`/`&#xHH;`). */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const isHex = code[1]?.toLowerCase() === 'x';
      const cp = isHex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    const key = code.toLowerCase();
    return NAMED_ENTITIES[key] ?? m;
  });
}

/** Remove `<script>`/`<style>` (com conteúdo) e demais tags HTML; decodifica entidades; espaços colapsados. */
export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Corta em até `max` chars, preferindo terminar na última frase (`.`/`!`/`?`) que cabe. */
export function truncateAtSentence(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  let cut = -1;
  for (const m of ['.', '!', '?']) {
    const i = slice.lastIndexOf(m);
    if (i > cut) cut = i;
  }
  if (cut >= 0) return slice.slice(0, cut + 1).trim();
  return slice.trim();
}

function pickImage(img: unknown): string | null {
  const i = (img ?? {}) as AnyRec;
  const m = i.medium as AnyRec | undefined;
  const l = i.large as AnyRec | undefined;
  const t = i.thumb as AnyRec | undefined;
  const url = (m?.url ?? l?.url ?? t?.url ?? i.url ?? i.name) as string | undefined;
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
}

export function summarizeProduct(raw: unknown): ProductSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = rec(raw);
  const id = Number(p.id);
  const nome = typeof p.name === 'string' ? p.name.trim() : '';
  if (!id || !Number.isFinite(id) || !nome) return null;

  const brand = rec(p.brand);
  const marca = typeof brand.name === 'string' && brand.name.trim() ? brand.name.trim() : null;

  const texts = rec(p.texts);
  const descRaw = typeof texts.description === 'string' ? texts.description : '';
  const descricao = truncateAtSentence(stripHtml(descRaw), 600);

  const categorias = list(p.categories)
    .map((c) => (typeof (c as AnyRec)?.name === 'string' ? (c as AnyRec).name as string : null))
    .filter((n): n is string => !!n);

  const skus = list(p.skus) as AnyRec[];

  const cores: string[] = [];
  const modelos: string[] = [];
  let precoMin: number | null = null;
  let precoMax: number | null = null;
  const semEstoque: string[] = [];
  const variantesDetalhe: ProductSummary['variantesDetalhe'] = [];

  for (const sku of skus) {
    const variacoes = list((sku as AnyRec).variations) as AnyRec[];
    let cor: string | null = null;
    let modelo: string | null = null;
    for (const v of variacoes) {
      const name = typeof v?.name === 'string' ? v.name : '';
      const value = typeof v?.value === 'string' ? v.value.trim() : '';
      if (!value) continue;
      if (COLOR_RE.test(name)) cor = value;
      else if (MODEL_RE.test(name)) modelo = value;
    }
    if (cor && !cores.includes(cor)) cores.push(cor);
    if (modelo && !modelos.includes(modelo)) modelos.push(modelo);

    const priceSale = typeof sku.price_sale === 'number' ? sku.price_sale : null;
    const priceDiscount = typeof sku.price_discount === 'number' ? sku.price_discount : null;
    // Yampi manda price_discount: 0 em SKUs sem promoção — 0 não é um preço válido,
    // cai pro price_sale (e null se nenhum dos dois for > 0).
    const preco = (priceDiscount !== null && priceDiscount > 0)
      ? priceDiscount
      : (priceSale !== null && priceSale > 0 ? priceSale : null);
    if (typeof preco === 'number') {
      precoMin = precoMin === null ? preco : Math.min(precoMin, preco);
      precoMax = precoMax === null ? preco : Math.max(precoMax, preco);
    }

    const emEstoque = typeof sku.total_in_stock === 'number' ? sku.total_in_stock > 0 : true;
    if (!emEstoque) {
      const label = [cor, modelo].filter(Boolean).join(' / ');
      if (label) semEstoque.push(label);
    }

    const skuId = Number(sku.id);
    if (Number.isFinite(skuId)) {
      variantesDetalhe.push({
        skuId,
        titulo: typeof sku.title === 'string' ? sku.title.trim() : '',
        cor,
        modelo,
        preco: typeof preco === 'number' ? preco : null,
        emEstoque,
      });
    }
  }

  const imgs = list(p.images);
  const imagem = imgs.length ? pickImage(imgs[0]) : null;

  return {
    id,
    nome,
    marca,
    descricao,
    categorias,
    cores,
    modelos,
    precoMin,
    precoMax,
    variantes: skus.length,
    semEstoque,
    imagem,
    variantesDetalhe,
  };
}

/** Monta o bloco "Produto do carrinho" injetado no contexto do agente. */
export function describeProductForAgent(s: ProductSummary): string {
  const lines: string[] = [];
  lines.push(`Produto do carrinho: ${s.nome}${s.marca ? ` (${s.marca})` : ''}`);
  if (s.descricao) lines.push(s.descricao);
  if (s.categorias.length) lines.push(`Categorias: ${s.categorias.join(', ')}`);
  if (s.cores.length) lines.push(`Cores disponíveis: ${s.cores.join(', ')}`);
  if (s.modelos.length) lines.push(`Modelos: ${s.modelos.join(', ')}`);
  if (s.precoMin !== null && s.precoMax !== null) {
    lines.push(
      s.precoMin === s.precoMax
        ? `Preço: ${formatBRL(s.precoMin)}`
        : `Preço: ${formatBRL(s.precoMin)} a ${formatBRL(s.precoMax)}`,
    );
  }
  if (s.semEstoque.length) lines.push(`Sem estoque: ${s.semEstoque.join(', ')}`);
  return lines.join('\n');
}

const PRODUCT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Resumo do produto com cache (yampi_products_cache, TTL 24h por padrão).
 * Nunca lança: qualquer erro de rede/API/credencial devolve o cache velho
 * (se existir) ou null.
 */
export async function resolveProductSummary(
  supabase: SupabaseClient,
  productId: number,
  opts: { force?: boolean; ttlMs?: number } = {},
): Promise<ProductSummary | null> {
  const ttlMs = opts.ttlMs ?? PRODUCT_CACHE_TTL_MS;
  let cachedSummary: ProductSummary | null = null;
  try {
    const { data } = await supabase
      .from('yampi_products_cache')
      .select('summary, fetched_at')
      .eq('product_id', productId)
      .maybeSingle();
    const c = data as { summary: unknown; fetched_at: string } | null;
    if (c) {
      cachedSummary = (c.summary ?? null) as ProductSummary | null;
      const fresh = Date.now() - new Date(c.fetched_at).getTime() < ttlMs;
      if (fresh && !opts.force) return cachedSummary;
    }
  } catch (_) {
    // cache indisponível — segue pra API; se ela também falhar, devolve null.
  }

  try {
    const { createYampiClientForConnection } = await import('./yampi-client.ts');
    const bound = await createYampiClientForConnection(supabase);
    if (!bound) return cachedSummary;
    const raw = await bound.client.getProduct(productId);
    const summary = summarizeProduct(raw);
    if (!summary) return cachedSummary;
    await supabase.from('yampi_products_cache').upsert(
      { product_id: productId, summary, fetched_at: new Date().toISOString() },
      { onConflict: 'product_id' },
    );
    return summary;
  } catch (_) {
    return cachedSummary;
  }
}
