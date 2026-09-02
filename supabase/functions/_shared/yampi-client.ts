/**
 * YampiApiClient — typed client for the Yampi public API (api.dooki.com.br/v2).
 *
 * Shared by yampi-connect, yampi-process-event and ai-agent-execute (YMP-1.2).
 *
 * Auth model (unlike Kiwify's OAuth): static credential headers on every request —
 *   User-Token / User-Secret-Key (Perfil → Credenciais de API no painel Yampi).
 * Base URL: https://api.dooki.com.br/v2/{alias}/...  (auth/me is the one aliasless route).
 *
 * Rate limiting: Yampi documents 60 req/min on write endpoints; we apply one in-process
 * token bucket (60/min) to ALL calls + exponential backoff with jitter for 429/5xx.
 * 401/403 surface as YampiAuthError and are never retried.
 *
 * Secrets are never logged; error messages are sanitized to status + Yampi message.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TokenBucket } from './kiwify-client.ts';

export const YAMPI_BASE_URL = 'https://api.dooki.com.br/v2';

/** Events registered on connect — everything the CRM esteira consumes. */
export const YAMPI_WEBHOOK_EVENTS = [
  'cart.reminder',
  'order.created',
  'order.paid',
  'order.status.updated',
  'transaction.payment.refused',
] as const;

/**
 * Canonical CRM triggers. Fonte de verdade: _shared/yampi-events.ts (re-export aqui
 * para consumidores que já importam do client). Inclui `checkout_iniciado`, que não é
 * webhook — é sintetizado pelo yampi-reconcile a partir de GET /checkout/carts.
 */
export { YAMPI_TRIGGERS, type YampiTrigger } from './yampi-events.ts';

// ── Errors ───────────────────────────────────────────────────────────────────

/** Credential failure (HTTP 401/403). Never retried. */
export class YampiAuthError extends Error {
  readonly code = 'auth_error';
  constructor(message: string) {
    super(message);
    this.name = 'YampiAuthError';
  }
}

/** Non-auth API failure after retries are exhausted. */
export class YampiApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'YampiApiError';
    this.status = status;
  }
}

// ── Types (subset of fields the CRM consumes) ────────────────────────────────

export interface YampiCredentials {
  alias: string;
  userToken: string;
  userSecret: string;
}

export interface YampiConnectionRow {
  id: string;
  alias: string;
  user_token_enc: string;
  user_secret_enc: string;
  webhook_id: string | null;
  webhook_secret_enc: string | null;
  enforce_signature: boolean;
  status: string;
  last_error: string | null;
  lead_intake_enabled: boolean;
}

export interface YampiWebhook {
  id: number;
  name: string;
  url: string;
  active: boolean;
  secret_key?: string;
}

export interface YampiAbandonedCart {
  id: number;
  token: string;
  simulate_url?: string;
  unauth_simulate_url?: string;
  customer_id?: number | null;
  tracking_data?: { name?: string; email?: string } | null;
  totalizers?: { total?: number; total_formated?: string } | null;
  customer?: { data?: { id?: number; email?: string; phone?: { full_number?: string } } } | null;
  items?: { data?: Array<{ quantity?: number; sku?: { data?: { id?: number; sku?: string; title?: string; price_sale?: number } } }> } | null;
  updated_at?: unknown;
  created_at?: unknown;
}

export interface YampiPromocode {
  id: number;
  code: string;
  value: number;
  discount_type: string;
  expired?: boolean;
  active?: boolean;
}

export interface YampiPaymentLink {
  id: number;
  link_url: string;
  name: string;
  whatsapp?: { message?: string; link?: string };
}

type Json = Record<string, unknown>;

// ── Client ───────────────────────────────────────────────────────────────────

export interface YampiClientDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const MAX_RETRIES = 3;

export class YampiApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly bucket: TokenBucket;

  constructor(private readonly creds: YampiCredentials, deps: YampiClientDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    const now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = deps.random ?? Math.random;
    // 60 req/min, refilled linearly.
    this.bucket = new TokenBucket(60, 60 / 60_000, now, this.sleep);
  }

  get alias(): string {
    return this.creds.alias;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Token': this.creds.userToken,
      'User-Secret-Key': this.creds.userSecret,
    };
  }

  /**
   * Core request. `path` is appended to `{base}/{alias}` unless `aliasless` is set
   * (only /auth/me). Retries 429/5xx with exponential backoff + jitter.
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    opts: { body?: Json; query?: Record<string, string>; aliasless?: boolean } = {},
  ): Promise<T> {
    const base = opts.aliasless ? YAMPI_BASE_URL : `${YAMPI_BASE_URL}/${this.creds.alias}`;
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

    let lastStatus = 0;
    let lastMessage = 'request failed';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.bucket.acquire();
      let res: Response;
      try {
        res = await this.fetchImpl(url.toString(), {
          method,
          headers: this.headers(),
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
      } catch (e) {
        lastStatus = 0;
        lastMessage = `network error: ${(e as Error).message}`;
        if (attempt < MAX_RETRIES) {
          await this.backoff(attempt);
          continue;
        }
        break;
      }

      if (res.status === 401 || res.status === 403) {
        throw new YampiAuthError(`Yampi rejected the credentials (HTTP ${res.status})`);
      }

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return await res.json() as T;
      }

      lastStatus = res.status;
      lastMessage = await this.safeErrorMessage(res);

      // Retry only rate-limit and server errors.
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await this.backoff(attempt);
        continue;
      }
      break;
    }
    throw new YampiApiError(`Yampi API error (HTTP ${lastStatus}): ${lastMessage}`, lastStatus);
  }

  private async backoff(attempt: number): Promise<void> {
    const base = 1000 * Math.pow(2, attempt);
    await this.sleep(base + this.random() * base);
  }

  private async safeErrorMessage(res: Response): Promise<string> {
    try {
      const body = await res.json() as Json;
      const msg = (body.message ?? (body.error as Json | undefined)?.message ?? body.error) as unknown;
      return typeof msg === 'string' ? msg.slice(0, 300) : res.statusText;
    } catch {
      return res.statusText;
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Validates the credentials. Throws YampiAuthError when invalid. */
  authMe(): Promise<Json> {
    return this.request<Json>('POST', '/auth/me', { aliasless: true });
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  async listWebhooks(): Promise<YampiWebhook[]> {
    const res = await this.request<{ data: YampiWebhook[] }>('GET', '/webhooks');
    return res.data ?? [];
  }

  /** Registers a webhook; response includes the HMAC `secret_key`. */
  async createWebhook(url: string, events: readonly string[], name: string): Promise<YampiWebhook> {
    const res = await this.request<YampiWebhook | { data: YampiWebhook }>('POST', '/webhooks', {
      body: { url, events: [...events], name },
    });
    return (res as { data?: YampiWebhook }).data ?? res as YampiWebhook;
  }

  deleteWebhook(id: number | string): Promise<void> {
    return this.request<void>('DELETE', `/webhooks/${id}`);
  }

  // ── Abandoned carts ───────────────────────────────────────────────────────

  /** Search abandoned carts by customer name/email/phone (`q`), newest first. */
  async searchAbandonedCarts(q: string, limit = 5): Promise<YampiAbandonedCart[]> {
    const res = await this.request<{ data: YampiAbandonedCart[] }>('GET', '/checkout/carts', {
      query: { q, limit: String(limit), include: 'items,customer', sort: '-created_at' },
    });
    return res.data ?? [];
  }

  /**
   * Recent carts with customer data, newest first — used by yampi-reconcile to
   * synthesize `checkout_iniciado`. `dateFilter` format: `updated_at:YYYY-MM-DD|YYYY-MM-DD`.
   */
  async listRecentCarts(dateFilter: string, limit = 100): Promise<YampiAbandonedCart[]> {
    const res = await this.request<{ data: YampiAbandonedCart[] }>('GET', '/checkout/carts', {
      query: {
        date: dateFilter,
        customersData: 'true',
        limit: String(limit),
        include: 'items,customer',
        sort: '-updated_at',
      },
    });
    return res.data ?? [];
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async getOrder(id: number | string, include = 'transactions,items,status,customer'): Promise<Json> {
    const res = await this.request<{ data: Json }>('GET', `/orders/${id}`, { query: { include } });
    return (res.data ?? res) as Json;
  }

  async searchOrders(q: string, limit = 5, include = 'transactions,items,status'): Promise<Json[]> {
    const res = await this.request<{ data: Json[] }>('GET', '/orders', {
      query: { q, limit: String(limit), include, sort: '-created_at' },
    });
    return res.data ?? [];
  }

  // ── Promocodes (cupons) ───────────────────────────────────────────────────

  async findPromocode(code: string): Promise<YampiPromocode | null> {
    const res = await this.request<{ data: YampiPromocode[] }>('GET', '/pricing/promocodes', {
      query: { q: code, limit: '10' },
    });
    return (res.data ?? []).find((p) => p.code?.toUpperCase() === code.toUpperCase()) ?? null;
  }

  async createPromocode(body: {
    code: string;
    value: number;
    discount_type: 'p' | 'v';
    quantity?: number;
    min_value?: number;
    start_at?: string;
    end_at?: string;
    active?: boolean;
    once_per_customer?: boolean;
    accumulate?: boolean;
    free_shipment?: boolean;
    abandoned_cart?: boolean;
  }): Promise<YampiPromocode> {
    const res = await this.request<YampiPromocode | { data: YampiPromocode }>('POST', '/pricing/promocodes', {
      body: body as unknown as Json,
    });
    return (res as { data?: YampiPromocode }).data ?? res as YampiPromocode;
  }

  // ── Payment links ─────────────────────────────────────────────────────────

  async createPaymentLink(body: {
    name: string;
    active: boolean;
    skus: Array<{ id: number; quantity: number }>;
    promocode_id?: number | null;
    customer_id?: number | null;
  }): Promise<YampiPaymentLink> {
    const res = await this.request<YampiPaymentLink | { data: YampiPaymentLink }>(
      'POST',
      '/checkout/payment-link',
      { body: body as unknown as Json },
    );
    return (res as { data?: YampiPaymentLink }).data ?? res as YampiPaymentLink;
  }
}

// ── Supabase-bound factory ────────────────────────────────────────────────────

export async function loadYampiConnection(
  supabase: SupabaseClient,
): Promise<YampiConnectionRow | null> {
  const { data } = await supabase
    .from('yampi_connections')
    .select('id, alias, user_token_enc, user_secret_enc, webhook_id, webhook_secret_enc, enforce_signature, status, last_error, lead_intake_enabled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as YampiConnectionRow | null) ?? null;
}

async function decrypt(supabase: SupabaseClient, encrypted: string, context: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('app_decrypt_secret', {
    p_encrypted: encrypted,
    p_context: context,
  });
  if (error) return null;
  return (data as string) ?? null;
}

/**
 * Loads the (single-tenant) connection and returns a ready client, or null when
 * the integration is not connected. Service-role Supabase client required.
 */
export async function createYampiClientForConnection(
  supabase: SupabaseClient,
  row?: YampiConnectionRow | null,
): Promise<{ client: YampiApiClient; row: YampiConnectionRow } | null> {
  const conn = row ?? await loadYampiConnection(supabase);
  if (!conn) return null;
  const ctx = `yampi_${conn.alias}`;
  const userToken = await decrypt(supabase, conn.user_token_enc, ctx);
  const userSecret = await decrypt(supabase, conn.user_secret_enc, ctx);
  if (!userToken || !userSecret) return null;
  return { client: new YampiApiClient({ alias: conn.alias, userToken, userSecret }), row: conn };
}

export async function decryptYampiWebhookSecret(
  supabase: SupabaseClient,
  conn: YampiConnectionRow,
): Promise<string | null> {
  if (!conn.webhook_secret_enc) return null;
  return decrypt(supabase, conn.webhook_secret_enc, `yampi_${conn.alias}`);
}
