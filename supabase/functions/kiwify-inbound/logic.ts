/**
 * KIWIFY INBOUND — pure logic (KFY-1.4)
 *
 * Signature verification + idempotency-key derivation, decoupled from Supabase / the
 * Deno.serve handler so they can be unit-tested directly (index.ts imports from here).
 */

import { createHash } from 'node:crypto';

// The 10 Kiwify triggers (config names). Mirrors _shared/kiwify-client.ts KIWIFY_TRIGGERS.
export const KIWIFY_TRIGGERS = [
  'boleto_gerado', 'pix_gerado', 'carrinho_abandonado', 'compra_recusada',
  'compra_aprovada', 'compra_reembolsada', 'chargeback', 'subscription_canceled',
  'subscription_late', 'subscription_renewed',
] as const;
export type KiwifyTrigger = (typeof KIWIFY_TRIGGERS)[number];

const TRIGGER_SET = new Set<string>(KIWIFY_TRIGGERS);

// Best-effort map from observed payload webhook_event_type/order_status → config trigger.
// TODO(verify): the payload event_type names diverge from the config trigger names
// (research §3). These aliases are unconfirmed; KFY-1.5 owns the authoritative mapping.
// `trigger` here is a convenience only — `event_type` always stores the raw payload value.
export const EVENT_TYPE_TO_TRIGGER: Record<string, KiwifyTrigger> = {
  pix_created: 'pix_gerado',
  billet_created: 'boleto_gerado',
  order_approved: 'compra_aprovada',
  order_rejected: 'compra_recusada',
  order_refused: 'compra_recusada',
  order_refunded: 'compra_reembolsada',
  order_chargeback: 'chargeback',
  cart_abandoned: 'carrinho_abandonado',
  abandoned_cart: 'carrinho_abandonado',
  subscription_canceled: 'subscription_canceled',
  subscription_late: 'subscription_late',
  subscription_renewed: 'subscription_renewed',
};

export type Json = Record<string, unknown>;

// ── Signature (best-guess mechanism — see index.ts NOTES) ─────────────────────

export async function hmacSha1Hex(body: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(body));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time hex-string comparison (length-independent; no early exit on mismatch). */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Verifies a Kiwify `?signature=` param against HMAC-SHA1(raw_body, key=token), hex. */
export async function verifySignature(
  rawBody: string,
  signatureParam: string | null,
  webhookToken: string | null,
): Promise<boolean> {
  if (!webhookToken || !signatureParam) return false;
  const expected = await hmacSha1Hex(rawBody, webhookToken);
  return constantTimeEqual(expected.toLowerCase(), signatureParam.toLowerCase());
}

// ── Payload field extraction (dual-case tolerant) ─────────────────────────────
// Inbound payloads may capitalize object keys (Customer/Product) unlike the REST API
// snake_case (research §3, TODO verify). We probe both cases.

export function pick(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const rec = obj as Json;
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null) return rec[k];
  }
  return undefined;
}

export function asString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

export function md5Hex(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

// ── dedup_key derivation (research §5) ────────────────────────────────────────

export interface DerivedEvent {
  eventType: string;
  trigger: string | null;
  orderId: string | null;
  subscriptionId: string | null;
  dedupKey: string;
}

export function deriveEvent(payload: Json, rawBody: string): DerivedEvent {
  const eventTypeRaw = asString(pick(payload, 'webhook_event_type', 'event_type'))
    ?? asString(pick(payload, 'order_status'))
    ?? 'unknown';

  const trigger = TRIGGER_SET.has(eventTypeRaw)
    ? eventTypeRaw
    : (EVENT_TYPE_TO_TRIGGER[eventTypeRaw] ?? null);

  const orderId = asString(pick(payload, 'order_id', 'order_ref'));

  const subscriptionObj = pick(payload, 'subscription', 'Subscription');
  const subscriptionId = asString(pick(payload, 'subscription_id'))
    ?? asString(pick(subscriptionObj, 'id', 'subscription_id'));

  const isSubscriptionEvent = subscriptionId !== null
    || (trigger !== null && trigger.startsWith('subscription_'));
  const isCart = trigger === 'carrinho_abandonado'
    || (orderId === null && eventTypeRaw.toLowerCase().includes('cart'))
    || (orderId === null && eventTypeRaw.toLowerCase().includes('abandon'));

  let dedupKey: string;

  if (isSubscriptionEvent && subscriptionId) {
    // subscription_renewed recurs — the charge date/cycle must be part of the key so
    // renewals don't collide. Field name unconfirmed (TODO verify); probe common names,
    // fall back to order_id (each renewal usually has its own order) then a fixed marker.
    const chargeDate =
      asString(pick(subscriptionObj, 'charge_date', 'next_charge_date', 'next_payment_date', 'current_period_end'))
      ?? asString(pick(payload, 'charge_date', 'approved_date', 'created_at'))
      ?? orderId
      ?? 'nocharge';
    dedupKey = `${subscriptionId}|${chargeDate}`;
  } else if (isCart) {
    // carrinho_abandonado has no order_id. Stable field is unconfirmed (TODO verify):
    // checkout_id/cart_id is the best candidate; fall back to md5(email||product_id).
    const email = asString(pick(pick(payload, 'Customer', 'customer'), 'email'))
      ?? asString(pick(payload, 'email')) ?? '';
    const productId = asString(pick(pick(payload, 'Product', 'product'), 'product_id', 'id'))
      ?? asString(pick(payload, 'product_id')) ?? '';
    const checkoutId = asString(pick(payload, 'checkout_id', 'cart_id'))
      ?? asString(pick(pick(payload, 'Checkout', 'checkout'), 'id')) ?? '';
    dedupKey = md5Hex(`${email}|${productId}|${checkoutId}`);
  } else if (orderId) {
    dedupKey = orderId;
  } else {
    // No stable identity field found — fall back to a hash of the raw body so exact
    // Kiwify retries still dedupe. Documented degraded path; process-event may re-resolve.
    dedupKey = md5Hex(rawBody);
  }

  return { eventType: eventTypeRaw, trigger, orderId, subscriptionId, dedupKey };
}
