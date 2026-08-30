/**
 * kiwify-reconcile — pure logic (KFY-1.6)
 *
 * Sale-status → trigger mapping, synthesized-event construction, date-window formatting
 * and the cron service_role JWT check. Side-effect free so it is unit-testable without
 * Supabase / network (index.ts imports from here).
 */

import type { KiwifySale } from '../_shared/kiwify-client.ts';
import type { KiwifyTrigger } from '../_shared/kiwify-events.ts';

/**
 * Map a REST `/sales` status (+ payment method) to the canonical Kiwify trigger.
 * Only terminal / actionable states synthesize an event; transient states (pending,
 * processing, refund_requested…) return null and are skipped by the reconciler.
 *
 * Sale statuses (research §4): approved, authorized, chargedback, paid, pending,
 * pending_refund, processing, refunded, refund_requested, refused, waiting_payment.
 * Subscriptions are NOT covered here — /sales returns orders; subscription reconciliation
 * would need a different endpoint (out of scope, documented in the story).
 */
export function saleStatusToTrigger(
  status: string | null | undefined,
  paymentMethod: string | null | undefined,
): KiwifyTrigger | null {
  const s = (status ?? '').toLowerCase();
  const pm = (paymentMethod ?? '').toLowerCase();

  switch (s) {
    case 'paid':
    case 'approved':
    case 'authorized':
      return 'compra_aprovada';
    case 'refunded':
      return 'compra_reembolsada';
    case 'chargedback':
      return 'chargeback';
    case 'refused':
      return 'compra_recusada';
    case 'waiting_payment':
      // Disambiguate the "awaiting payment" state by payment method.
      if (pm === 'pix') return 'pix_gerado';
      if (pm === 'boleto') return 'boleto_gerado';
      return null; // credit_card waiting → no dedicated trigger
    default:
      // pending, processing, pending_refund, refund_requested → transient, skip.
      return null;
  }
}

export interface SynthesizedEvent {
  eventType: string;
  trigger: KiwifyTrigger;
  orderId: string;
  dedupKey: string;
  rawPayload: Record<string, unknown>;
}

/**
 * Build a synthesized webhook event from a REST sale, in a shape parseKiwifyPayload
 * (kiwify-events.ts) understands. `event_type` is set to the canonical trigger so
 * resolveTrigger picks it up directly; `dedup_key` is the order id (matches KFY-1.4).
 * `_reconcile` marks provenance (AC4).
 */
export function synthesizeEventPayload(sale: KiwifySale, trigger: KiwifyTrigger): SynthesizedEvent {
  const s = sale as KiwifySale & {
    payment?: { charge_amount?: number };
    boleto_url?: string;
    pix_code?: string;
  };

  const rawPayload: Record<string, unknown> = {
    order_id: sale.id,
    order_ref: sale.reference ?? null,
    webhook_event_type: trigger,
    order_status: sale.status ?? null,
    payment_method: sale.payment_method ?? null,
    customer: sale.customer ?? null,
    product: sale.product ?? null,
    net_amount: sale.net_amount ?? null,
    charge_amount: s.payment?.charge_amount ?? sale.net_amount ?? null,
    created_at: sale.created_at ?? null,
    updated_at: sale.updated_at ?? null,
    approved_date: sale.approved_date ?? null,
    boleto_url: s.boleto_url ?? null,
    pix_code: s.pix_code ?? null,
    _reconcile: {
      source: 'reconcile',
      sale_id: sale.id,
      synthesized_at: new Date().toISOString(),
    },
  };

  return {
    eventType: trigger,
    trigger,
    orderId: sale.id,
    dedupKey: sale.id,
    rawPayload,
  };
}

/** Format a Date as YYYY-MM-DD (UTC) for the /sales start_date/end_date params. */
export function formatDateYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Compute the reconciliation window [start, end] as YYYY-MM-DD strings.
 * `lookbackDays` is clamped to Kiwify's 90-day maximum window.
 */
export function reconciliationWindow(now: Date, lookbackDays: number): { start: string; end: string } {
  const days = Math.min(Math.max(1, Math.floor(lookbackDays)), 90);
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: formatDateYMD(start), end: formatDateYMD(now) };
}

/**
 * True when `bearer` is a JWT whose `role` claim is `service_role`. The signature is
 * assumed already validated by the Supabase gateway (deploy WITHOUT --no-verify-jwt);
 * this only reads the role claim. Rotation-proof — does NOT string-compare against
 * SUPABASE_SERVICE_ROLE_KEY (which drifts after the new-API-keys migration).
 */
export function isServiceRoleJwt(bearer: string | null | undefined): boolean {
  if (!bearer) return false;
  const parts = bearer.split('.');
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}
