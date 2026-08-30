/**
 * kiwify-events — pure helpers for kiwify-process-event / kiwify-dispatch-worker (KFY-1.5).
 *
 * Kept side-effect free (no Supabase/network) so the risky logic of a God Node —
 * precedence ranking, capitalization-resilient payload parsing, monetary/variable
 * rendering — is unit-testable in isolation.
 *
 * Conventions (CONFIRMED against a real sandbox payload captured 2026-07-02 — architecture §8.7):
 *  - The inbound webhook payload capitalizes objects (Customer/Product/Commissions) unlike
 *    the snake_case REST API — the parser reads BOTH cases. CONFIRMED with real payload.
 *  - `Customer.mobile` (phone), `Commissions.charge_amount` (centavos), `pix_code` (pix
 *    copy-paste), `Product.product_id`/`product_name`: all CONFIRMED against the real payload.
 *  - Monetary values are integers in CENTAVOS (12048 → R$ 120,48). CONFIRMED.
 *  - The config `trigger` name differs from the payload `webhook_event_type`. (§3) KFY-1.4
 *    already resolves and stores the canonical `trigger` on kiwify_webhook_events, so mapping
 *    and precedence key off that; EVENT_TYPE_TO_TRIGGER is a fallback when it is null.
 */

export const KIWIFY_TRIGGERS = [
  'boleto_gerado',
  'pix_gerado',
  'carrinho_abandonado',
  'compra_recusada',
  'compra_aprovada',
  'compra_reembolsada',
  'chargeback',
  'subscription_canceled',
  'subscription_late',
  'subscription_renewed',
] as const;
export type KiwifyTrigger = (typeof KIWIFY_TRIGGERS)[number];

/**
 * Lifecycle rank per trigger — a later-arriving event whose rank is LOWER than what was
 * already processed for the same order must not regress the contact (AC3). Refund/chargeback
 * sit ABOVE "paid" because they are later in the order lifecycle.
 */
export const PRECEDENCE_RANK: Record<KiwifyTrigger, number> = {
  carrinho_abandonado: 0, // no order yet
  pix_gerado: 1, // awaiting payment
  boleto_gerado: 1, // awaiting payment
  compra_recusada: 2, // failed attempt
  subscription_late: 2, // overdue
  compra_aprovada: 3, // paid
  subscription_renewed: 3, // active/recurring
  compra_reembolsada: 4, // post-paid reversal
  chargeback: 4, // post-paid reversal
  subscription_canceled: 4, // terminal
};

/**
 * Best-effort map from the payload `webhook_event_type`/`order_status` to the config trigger.
 * Only used as a fallback when kiwify_webhook_events.trigger is null (KFY-1.4 normally fills it).
 *
 * CONFIRMED (real sandbox payload 2026-07-02, architecture §8.7):
 *   - `billet_created` → `boleto_gerado`
 *   - `pix_created`    → `pix_gerado`
 * The other 8 mappings follow the `_created`/`_approved`/`_refunded` naming convention but only
 * ONE real example was captured, so they remain TODO(verify) until more payloads are collected.
 * Do NOT remove any mapping — the guess is safer than a gap.
 */
export const EVENT_TYPE_TO_TRIGGER: Record<string, KiwifyTrigger> = {
  pix_created: 'pix_gerado', // CONFIRMED (real payload 2026-07-02)
  billet_created: 'boleto_gerado', // CONFIRMED (real payload 2026-07-02)
  order_approved: 'compra_aprovada', // TODO(verify) — convention guess
  paid: 'compra_aprovada', // TODO(verify) — convention guess
  order_rejected: 'compra_recusada', // TODO(verify) — convention guess
  refused: 'compra_recusada', // TODO(verify) — convention guess
  order_refunded: 'compra_reembolsada', // TODO(verify) — convention guess
  refunded: 'compra_reembolsada', // TODO(verify) — convention guess
  chargeback: 'chargeback', // TODO(verify) — convention guess
  chargedback: 'chargeback', // TODO(verify) — convention guess
  abandoned_cart: 'carrinho_abandonado', // TODO(verify) — convention guess
  subscription_canceled: 'subscription_canceled', // TODO(verify) — convention guess
  subscription_late: 'subscription_late', // TODO(verify) — convention guess
  subscription_renewed: 'subscription_renewed', // TODO(verify) — convention guess
};

export function isKiwifyTrigger(v: unknown): v is KiwifyTrigger {
  return typeof v === 'string' && (KIWIFY_TRIGGERS as readonly string[]).includes(v);
}

/** Resolve the canonical trigger, preferring the stored value, falling back via event_type. */
export function resolveTrigger(
  storedTrigger: string | null | undefined,
  eventType: string | null | undefined,
): KiwifyTrigger | null {
  if (isKiwifyTrigger(storedTrigger)) return storedTrigger;
  if (eventType && EVENT_TYPE_TO_TRIGGER[eventType]) return EVENT_TYPE_TO_TRIGGER[eventType];
  return null;
}

export function rankOf(trigger: KiwifyTrigger | null): number {
  return trigger ? PRECEDENCE_RANK[trigger] : -1;
}

/**
 * Triggers that represent product OWNERSHIP (KFY-2.2 course badge): a paid purchase or a
 * subscription renewal. Only these populate kiwify_lead_products. Payment-intent triggers
 * (pix/boleto), failures and reversals (refund/chargeback/cancel) are NOT ownership.
 */
export const POSSESSION_TRIGGERS: readonly KiwifyTrigger[] = ['compra_aprovada', 'subscription_renewed'];

export function isPossessionTrigger(trigger: KiwifyTrigger | null): boolean {
  return trigger !== null && POSSESSION_TRIGGERS.includes(trigger);
}

/**
 * Precedence decision for an incoming event vs. the last processed event of the same order.
 * Returns true when the incoming event may proceed (equal-or-more advanced, or newer on tie).
 * `lastRank`/`lastTs` are null when there is no prior processed event → always proceed.
 */
export function shouldProceed(
  incomingRank: number,
  incomingTs: number | null,
  lastRank: number | null,
  lastTs: number | null,
): boolean {
  if (lastRank === null) return true;
  if (incomingRank > lastRank) return true;
  if (incomingRank < lastRank) return false;
  // Same rank (e.g. a retry of the same status): proceed only if strictly newer.
  if (incomingTs !== null && lastTs !== null) return incomingTs > lastTs;
  return false;
}

// ── Payload parsing (capitalization-resilient) ────────────────────────────────

export interface NormalizedKiwifyEvent {
  orderId: string | null;
  subscriptionId: string | null;
  productId: string | null;
  productName: string | null;
  customerName: string | null;
  customerFirstName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Charge amount in centavos (integer), or null. */
  amountCentavos: number | null;
  boletoUrl: string | null;
  boletoBarcode: string | null;
  /** Raw boleto due date as sent by Kiwify ("06/07/2026", DD/MM/YYYY) — not reformatted. */
  boletoExpiry: string | null;
  pixCode: string | null;
  checkoutUrl: string | null;
  /** Payload timestamp in epoch ms, or null. Used for precedence tie-breaks. */
  eventTs: number | null;
}

type AnyRec = Record<string, unknown>;

/** Case-insensitive first-hit lookup across candidate keys on a record. */
function pick(obj: AnyRec | null | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  const lowerMap: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) lowerMap[k.toLowerCase()] = obj[k];
  for (const k of keys) {
    const v = lowerMap[k.toLowerCase()];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function asRecord(v: unknown): AnyRec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRec) : null;
}

/** Parse an integer centavos amount from a value that may be number or numeric string. */
function asCentavos(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Extract normalized fields from a raw inbound payload, tolerating both the capitalized
 * classic webhook shape (Customer/Product/Commissions) and the snake_case REST-like shape.
 */
export function parseKiwifyPayload(raw: AnyRec): NormalizedKiwifyEvent {
  const customer = asRecord(pick(raw, 'Customer', 'customer')) ?? {};
  const product = asRecord(pick(raw, 'Product', 'product')) ?? {};
  const commissions = asRecord(pick(raw, 'Commissions', 'commissions')) ?? {};
  const subscription = asRecord(pick(raw, 'subscription', 'Subscription'));

  const name = asString(pick(customer, 'full_name', 'name', 'Name'));
  const firstName = asString(pick(customer, 'first_name', 'firstName')) ??
    (name ? name.split(/\s+/)[0] : null);

  const amount = asCentavos(
    pick(commissions, 'charge_amount', 'chargeAmount') ??
      pick(raw, 'charge_amount', 'net_amount', 'chargeAmount'),
  );

  const tsRaw = asString(
    pick(raw, 'created_at', 'updated_at', 'approved_date', 'event_date', 'created_date'),
  );
  const tsParsed = tsRaw ? Date.parse(tsRaw) : NaN;

  return {
    orderId: asString(pick(raw, 'order_id', 'orderId', 'order_ref')),
    subscriptionId: asString(
      pick(subscription ?? {}, 'id', 'subscription_id') ?? pick(raw, 'subscription_id', 'subscriptionId'),
    ),
    productId: asString(pick(product, 'product_id', 'id', 'productId')),
    productName: asString(pick(product, 'product_name', 'name', 'productName')),
    customerName: name,
    customerFirstName: firstName,
    customerEmail: asString(pick(customer, 'email', 'Email'))?.toLowerCase() ?? null,
    customerPhone: asString(pick(customer, 'mobile', 'phone', 'Mobile', 'phone_number')),
    amountCentavos: amount,
    boletoUrl: asString(pick(raw, 'boleto_URL', 'boleto_url', 'boletoUrl')),
    boletoBarcode: asString(pick(raw, 'boleto_barcode', 'boletoBarcode', 'boleto_digitable_line')),
    boletoExpiry: asString(pick(raw, 'boleto_expiry_date', 'boleto_expiry', 'boletoExpiryDate')),
    pixCode: asString(pick(raw, 'pix_code', 'pixCode', 'pix_copy_paste')),
    checkoutUrl: asString(pick(raw, 'checkout_url', 'checkoutUrl', 'checkout_link')),
    eventTs: Number.isFinite(tsParsed) ? tsParsed : null,
  };
}

// ── Variable rendering ────────────────────────────────────────────────────────

/** Format integer centavos as Brazilian currency: 12048 → "R$ 120,48". */
export function centavosToBRL(centavos: number | null): string {
  if (centavos === null) return '';
  const reais = centavos / 100;
  return `R$ ${reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const SUPPORTED_VARIABLES = [
  'nome',
  'primeiro_nome',
  'produto',
  'valor',
  'link_boleto',
  'linha_digitavel',
  'vencimento_boleto',
  'pix_copia_cola',
  'link_checkout',
] as const;

/** Build the {{var}} → value map from a normalized event (AC8). */
export function buildVariableMap(ev: NormalizedKiwifyEvent): Record<string, string> {
  return {
    nome: ev.customerName ?? '',
    primeiro_nome: ev.customerFirstName ?? '',
    produto: ev.productName ?? '',
    valor: centavosToBRL(ev.amountCentavos),
    link_boleto: ev.boletoUrl ?? '',
    linha_digitavel: ev.boletoBarcode ?? '',
    vencimento_boleto: ev.boletoExpiry ?? '',
    pix_copia_cola: ev.pixCode ?? '',
    link_checkout: ev.checkoutUrl ?? '',
  };
}

/** Replace {{var}} tokens in a string using the provided map (unknown tokens → ''). */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = vars[key.toLowerCase()];
    return v !== undefined ? v : '';
  });
}

/** Merge a step's static variables with rendered values, rendering any {{var}} in the statics. */
export function resolveStepVariables(
  stepVars: Record<string, unknown> | null | undefined,
  eventVars: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...eventVars };
  if (stepVars) {
    for (const [k, v] of Object.entries(stepVars)) {
      if (typeof v === 'string') out[k] = renderTemplate(v, eventVars);
    }
  }
  return out;
}

// ── Opt-in gating (AC7) ───────────────────────────────────────────────────────

export type TemplateCategory = 'UTILITY' | 'MARKETING' | null;

/**
 * Decide whether a job may send given the template's Meta category and the contact opt-in.
 * UTILITY → always. MARKETING (or unresolved category, fail-safe) → only with opt-in.
 */
export function canSend(category: TemplateCategory, whatsappOptin: boolean): boolean {
  if (category === 'UTILITY') return true;
  return whatsappOptin === true;
}

/** Read the Meta template category from whatsapp_templates.json_data (case-normalized). */
export function categoryFromJsonData(jsonData: unknown): TemplateCategory {
  const rec = asRecord(jsonData);
  const raw = rec ? asString(pick(rec, 'category', 'Category')) : null;
  if (!raw) return null;
  const up = raw.toUpperCase();
  if (up === 'UTILITY' || up === 'MARKETING') return up;
  return null; // AUTHENTICATION or unknown → treat as non-utility (fail-safe MARKETING)
}
