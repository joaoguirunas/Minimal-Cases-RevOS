/**
 * YAMPI INBOUND — pure logic (YMP-1.3)
 *
 * Signature verification + trigger/idempotency derivation, decoupled from Supabase /
 * Deno.serve so it can be unit-tested directly (index.ts imports from here).
 *
 * Payload shape (docs.yampi.com.br/api-reference/webhooks/introduction):
 *   { event: "cart.reminder", time: "...", merchant: {id, alias}, resource: {...} }
 *
 * Signature (officially documented, unlike Kiwify):
 *   header X-Yampi-Hmac-SHA256 = base64(HMAC-SHA256(raw_body, webhook.secret_key))
 */

import { createHash } from 'node:crypto';

export type Json = Record<string, unknown>;

export const YAMPI_SIGNATURE_HEADER = 'X-Yampi-Hmac-SHA256';

// ── Signature ─────────────────────────────────────────────────────────────────

export async function hmacSha256Base64(body: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(body));
  let bin = '';
  for (const b of new Uint8Array(mac)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Constant-time string comparison (length-independent; no early exit). */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function verifySignature(
  rawBody: string,
  headerValue: string | null,
  secretKey: string | null,
): Promise<boolean> {
  if (!secretKey || !headerValue) return false;
  const expected = await hmacSha256Base64(rawBody, secretKey);
  return constantTimeEqual(expected, headerValue.trim());
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function md5Hex(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

export function asString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function get(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Json)[key];
  }
  return cur;
}

// ── Trigger derivation ────────────────────────────────────────────────────────

export interface DerivedEvent {
  eventType: string;
  trigger: string | null;
  orderId: string | null;
  cartToken: string | null;
  dedupKey: string;
}

/** Payment aliases Yampi uses for Pix / boleto on `resource.payments[].alias`. */
const PIX_ALIASES = new Set(['pix', 'pix_in_installments']);
const BILLET_ALIASES = new Set(['billet', 'boleto']);

function paymentAliases(resource: unknown): string[] {
  const payments = get(resource, 'payments');
  if (!Array.isArray(payments)) return [];
  return payments
    .map((p) => asString(get(p, 'alias')))
    .filter((a): a is string => !!a)
    .map((a) => a.toLowerCase());
}

function statusAlias(resource: unknown): string | null {
  return (
    asString(get(resource, 'status', 'data', 'alias')) ??
    asString(get(resource, 'status_alias')) ??
    asString(get(resource, 'status'))
  );
}

const CANCEL_STATUSES = new Set(['cancelled', 'canceled', 'refused', 'expired']);

/**
 * Maps a Yampi event + resource to the canonical CRM trigger.
 *   cart.reminder                → carrinho_abandonado
 *   order.created (pix/billet)   → pix_gerado / boleto_gerado (else pedido_criado)
 *   order.paid                   → pedido_pago
 *   order.status.updated         → pedido_cancelado | pedido_pago | pedido_status_atualizado
 *   transaction.payment.refused  → pagamento_recusado
 */
export function deriveTrigger(eventType: string, resource: unknown): string | null {
  switch (eventType) {
    case 'cart.reminder':
      return 'carrinho_abandonado';
    case 'order.created': {
      const aliases = paymentAliases(resource);
      if (aliases.some((a) => PIX_ALIASES.has(a))) return 'pix_gerado';
      if (aliases.some((a) => BILLET_ALIASES.has(a))) return 'boleto_gerado';
      return 'pedido_criado';
    }
    case 'order.paid':
      return 'pedido_pago';
    case 'order.status.updated': {
      const alias = (statusAlias(resource) ?? '').toLowerCase();
      if (CANCEL_STATUSES.has(alias)) return 'pedido_cancelado';
      if (alias === 'paid' || alias === 'authorized') return 'pedido_pago';
      return 'pedido_status_atualizado';
    }
    case 'transaction.payment.refused':
      return 'pagamento_recusado';
    default:
      return null;
  }
}

export function deriveEvent(payload: Json, rawBody: string): DerivedEvent {
  const eventType = asString(payload.event) ?? 'unknown';
  const resource = payload.resource;

  const resourceId = asString(get(resource, 'id'));
  const isCart = eventType.startsWith('cart.');
  const orderId = !isCart ? (resourceId ?? asString(get(resource, 'order_id'))) : null;
  const cartToken = isCart ? asString(get(resource, 'token')) : null;

  // Retries re-send identical bytes → identical dedup. Distinct reminders/status
  // changes for the same resource carry different `time`/body → new dedup.
  const dedupKey = `${resourceId ?? 'na'}:${md5Hex(rawBody).slice(0, 16)}`;

  return {
    eventType,
    trigger: deriveTrigger(eventType, resource),
    orderId,
    cartToken,
    dedupKey,
  };
}

// ── Contact extraction (shared with yampi-process-event) ─────────────────────

export interface ExtractedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  customerId: string | null;
}

/** Reads customer identity from any Yampi resource (cart or order). */
export function extractContact(payload: Json): ExtractedContact {
  const resource = payload.resource;
  const customer = get(resource, 'customer', 'data') ?? get(resource, 'customer');
  const tracking = get(resource, 'tracking_data');

  const name =
    asString(get(customer, 'name')) ??
    asString(get(customer, 'full_name')) ??
    asString(get(tracking, 'name'));
  const email =
    asString(get(customer, 'email')) ??
    asString(get(tracking, 'email'));
  const phone =
    asString(get(customer, 'phone', 'full_number')) ??
    asString(get(customer, 'phone', 'number')) ??
    asString(get(tracking, 'phone'));
  const customerId = asString(get(customer, 'id'));

  return {
    name,
    email: email ? email.toLowerCase().trim() : null,
    phone,
    customerId,
  };
}
