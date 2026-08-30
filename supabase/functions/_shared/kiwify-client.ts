/**
 * KiwifyApiClient — typed client for the Kiwify public API (public-api.kiwify.com/v1).
 *
 * Shared by kiwify-connect, kiwify-reconcile and kiwify-process-event.
 *
 * Responsibilities (KFY-1.2):
 *  - OAuth `POST /v1/oauth/token` (form-urlencoded, client_id+client_secret only, NO
 *    grant_type/scope — scopes are provisioned on the credential). Token cached in
 *    `kiwify_connections.access_token_enc` + `token_expires_at`; validity read from the
 *    `expires_in` returned at runtime (never hardcoded), refreshed proactively when less
 *    than `refreshMarginRatio` of the TTL remains.
 *  - Every request sends `Authorization: Bearer <token>` + `x-kiwify-account-id`.
 *  - In-process token-bucket rate limiter (100 req/min) + exponential backoff with jitter
 *    for 429/5xx. Auth failures surface as HTTP 400 `auth_error` (NOT 401/403) and are
 *    treated as credential errors — never retried.
 *  - Secrets are never logged; error messages are sanitized.
 *
 * The core (rate limiter, retry, token cache) is decoupled from Supabase via the
 * `KiwifyTokenStore` interface so it can be unit-tested with an injected fetch/clock.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const DEFAULT_KIWIFY_BASE_URL = 'https://public-api.kiwify.com/v1';

// ── Errors ───────────────────────────────────────────────────────────────────

/** Credential/authentication failure (Kiwify returns HTTP 400 `auth_error`). Never retried. */
export class KiwifyAuthError extends Error {
  readonly code = 'auth_error';
  constructor(message: string) {
    super(message);
    this.name = 'KiwifyAuthError';
  }
}

/** Non-auth API failure after retries are exhausted. `status` is the last HTTP status seen. */
export class KiwifyApiError extends Error {
  readonly status: number;
  readonly kiwifyCode?: string;
  constructor(message: string, status: number, kiwifyCode?: string) {
    super(message);
    this.name = 'KiwifyApiError';
    this.status = status;
    this.kiwifyCode = kiwifyCode;
  }
}

// ── Injectable dependencies (for tests) ──────────────────────────────────────

export interface KiwifyClientDeps {
  fetchImpl?: typeof fetch;
  /** Monotonic-ish clock in epoch ms. Defaults to Date.now. */
  now?: () => number;
  /** Sleep used between retries and while awaiting rate-limit tokens. */
  sleep?: (ms: number) => Promise<void>;
  /** Random in [0,1) for jitter. Defaults to Math.random. */
  random?: () => number;
}

// ── Token bucket rate limiter ────────────────────────────────────────────────

/**
 * Classic token bucket. `capacity` tokens refilled linearly at `refillPerMs` tokens/ms.
 * `acquire()` resolves once a token is available, sleeping the minimal wait otherwise.
 * In-process only — best-effort in the stateless Edge runtime (see architecture NOTES).
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    readonly capacity: number,
    readonly refillPerMs: number,
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {
    this.tokens = capacity;
    this.lastRefill = now();
  }

  private refill(): void {
    const t = this.now();
    const elapsed = t - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = t;
  }

  /** Milliseconds until at least one token is available (0 if available now). */
  msUntilAvailable(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillPerMs);
  }

  async acquire(): Promise<void> {
    // Loop to be robust against timer imprecision under an injected clock.
    for (;;) {
      const wait = this.msUntilAvailable();
      if (wait === 0) {
        this.tokens -= 1;
        return;
      }
      await this.sleep(wait);
    }
  }
}

// ── Token store abstraction ──────────────────────────────────────────────────

export interface CachedToken {
  accessToken: string | null;
  /** Epoch ms of expiry, or null if unknown/uncached. */
  expiresAt: number | null;
  scope: string | null;
}

export interface KiwifyTokenStore {
  load(): Promise<CachedToken>;
  save(token: { accessToken: string; expiresAt: number; scope: string | null }): Promise<void>;
}

// ── Typed API shapes (confirmed via official OpenAPI — see research §4) ───────
// Monetary values are integers in CENTAVOS (e.g. charge_amount 12048 = R$120,48).

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

export interface CreateWebhookParams {
  name: string;
  url: string;
  /** Single string: "all" or one productId (NOT an array). */
  products: string;
  triggers: KiwifyTrigger[];
  /** Webhook token you choose at creation; used to sign inbound deliveries. */
  token: string;
}

export interface KiwifyWebhook {
  id: string;
  name?: string;
  url?: string;
  products?: string;
  triggers?: string[];
  [k: string]: unknown;
}

export interface ListProductsParams {
  page_size: number;
  page_number: number;
}

export interface KiwifyProduct {
  id: string;
  name: string;
  type?: string;
  created_at?: string;
  currency?: string;
  /** In centavos, nullable. */
  price?: number | null;
  status?: string;
  payment_type?: string;
  [k: string]: unknown;
}

export interface ListSalesParams {
  /** Required. Window must be <= 90 days. */
  start_date: string;
  end_date: string;
  updated_at_start_date?: string;
  updated_at_end_date?: string;
  status?: string;
  payment_method?: 'boleto' | 'credit_card' | 'pix';
  product_id?: string;
  page_size: number;
  page_number: number;
}

export interface KiwifySaleCustomer {
  id?: string;
  name?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  mobile?: string;
  instagram?: string;
  country?: string;
  [k: string]: unknown;
}

export interface KiwifySale {
  id: string;
  reference?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  payment_method?: string;
  /** In centavos. */
  net_amount?: number;
  currency?: string;
  product?: { id: string; name: string };
  customer?: KiwifySaleCustomer;
  approved_date?: string;
  [k: string]: unknown;
}

export interface KiwifyPagination {
  count?: number;
  page_number?: number;
  page_size?: number;
}

export interface KiwifyListResponse<T> {
  pagination: KiwifyPagination;
  data: T[];
}

// ── Client config ────────────────────────────────────────────────────────────

export interface KiwifyClientConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
  store: KiwifyTokenStore;
  baseUrl?: string;
  deps?: KiwifyClientDeps;
  /** Max attempts for retryable (429/5xx) failures. Default 4. */
  maxRetries?: number;
  /** Base delay (ms) for exponential backoff. Default 500. */
  backoffBaseMs?: number;
  /** Cap on a single backoff delay (ms). Default 15000. */
  backoffCapMs?: number;
  /** Bucket capacity / requests-per-minute. Default 100. */
  rateLimitPerMin?: number;
  /** Refresh the token proactively when less than this fraction of the TTL remains. Default 0.25. */
  refreshMarginRatio?: number;
}

const OAUTH_ERROR_STATUS = 400;

// ── Client ───────────────────────────────────────────────────────────────────

export class KiwifyApiClient {
  private readonly accountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly store: KiwifyTokenStore;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly backoffCapMs: number;
  private readonly refreshMarginRatio: number;
  private readonly bucket: TokenBucket;

  /** In-memory copy of the cached token to avoid a DB read on every request. */
  private cached: CachedToken | null = null;
  /** Serializes concurrent refreshes so only one OAuth request is in flight. */
  private refreshInFlight: Promise<string> | null = null;

  constructor(config: KiwifyClientConfig) {
    this.accountId = config.accountId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.store = config.store;
    this.baseUrl = (config.baseUrl ?? DEFAULT_KIWIFY_BASE_URL).replace(/\/+$/, '');
    const deps = config.deps ?? {};
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.now = deps.now ?? (() => Date.now());
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = deps.random ?? Math.random;
    this.maxRetries = config.maxRetries ?? 4;
    this.backoffBaseMs = config.backoffBaseMs ?? 500;
    this.backoffCapMs = config.backoffCapMs ?? 15_000;
    this.refreshMarginRatio = config.refreshMarginRatio ?? 0.25;
    const perMin = config.rateLimitPerMin ?? 100;
    this.bucket = new TokenBucket(perMin, perMin / 60_000, this.now, this.sleep);
  }

  // ── OAuth token cache ──────────────────────────────────────────────────────

  /**
   * Returns a valid access token, refreshing proactively when it is within the
   * refresh margin of expiry. Concurrent callers share a single in-flight refresh.
   */
  async getToken(): Promise<string> {
    if (this.cached === null) {
      this.cached = await this.store.load();
    }

    if (this.tokenIsFresh(this.cached)) {
      return this.cached.accessToken!;
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.refreshToken().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  /** Grant scope from the last token response, for diagnostics (AC5). */
  get grantedScope(): string | null {
    return this.cached?.scope ?? null;
  }

  private tokenIsFresh(t: CachedToken): boolean {
    if (!t.accessToken || t.expiresAt === null) return false;
    const remaining = t.expiresAt - this.now();
    if (remaining <= 0) return false;
    return remaining > this.marginMs(t);
  }

  /**
   * Proactive-refresh window in ms.
   *  - When this instance issued the token, the full TTL is known (expiresAt - issuedAt),
   *    so we refresh once less than `refreshMarginRatio` of it remains (AC2).
   *  - On cold load from the store we only know `expiresAt` (the original TTL is not
   *    persisted), so we can only guard an absolute 60s floor against mid-request expiry.
   */
  private marginMs(t: CachedToken): number {
    const FLOOR_MS = 60_000;
    if (this.issuedAt === null || t.expiresAt === null) return FLOOR_MS;
    const ttl = t.expiresAt - this.issuedAt;
    if (ttl <= 0) return FLOOR_MS;
    return Math.max(ttl * this.refreshMarginRatio, FLOOR_MS);
  }

  private issuedAt: number | null = null;

  private async refreshToken(): Promise<string> {
    const url = `${this.baseUrl}/oauth/token`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok || !data?.access_token) {
      // Kiwify auth errors are HTTP 400 with { error: "auth_error", message }.
      const code = typeof data?.error === 'string' ? data.error : undefined;
      throw new KiwifyAuthError(
        `Kiwify OAuth failed (${res.status}${code ? ` ${code}` : ''})`,
      );
    }

    const accessToken: string = data.access_token;
    // expires_in is a STRING of seconds in the OpenAPI example ("86400"); parse defensively.
    const expiresInSec = Number(data.expires_in);
    const ttlMs = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec * 1000 : 0;
    const issuedAt = this.now();
    const expiresAt = ttlMs > 0 ? issuedAt + ttlMs : issuedAt + 3_600_000; // 1h fallback
    // Real Kiwify responses return `scope` as a JSON array of strings
    // (e.g. ["sales","webhooks",...]); older docs showed a space-delimited string.
    // Normalize both to a single space-joined string so missingScopes() can split it.
    const scope: string | null = Array.isArray(data.scope)
      ? data.scope.filter((s: unknown): s is string => typeof s === 'string').join(' ')
      : typeof data.scope === 'string'
        ? data.scope
        : null;

    this.issuedAt = issuedAt;
    this.cached = { accessToken, expiresAt, scope };
    await this.store.save({ accessToken, expiresAt, scope });

    return accessToken;
  }

  // ── HTTP core: rate limit + auth + retry ────────────────────────────────────

  private backoffDelay(attempt: number): number {
    const exp = Math.min(this.backoffCapMs, this.backoffBaseMs * 2 ** (attempt - 1));
    // Full jitter: random in [0, exp].
    return Math.floor(this.random() * exp);
  }

  /**
   * Authenticated request with rate limiting and retry. `path` is relative to baseUrl.
   * Returns parsed JSON of type T. Throws KiwifyAuthError (no retry) or KiwifyApiError.
   */
  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    let lastErr: KiwifyApiError | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      await this.bucket.acquire();

      const token = await this.getToken();
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'x-kiwify-account-id': this.accountId,
      };
      let payload: string | undefined;
      if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(opts.body);
      }

      const res = await this.fetchImpl(url.toString(), { method, headers, body: payload });

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json().catch(() => ({}))) as T;
      }

      const errData = await res.json().catch(() => ({} as Record<string, unknown>));
      const kiwifyCode = typeof errData?.error === 'string' ? errData.error : undefined;

      // Auth failure: Kiwify uses 400 `auth_error` (not 401/403). Never retry.
      if (res.status === OAUTH_ERROR_STATUS && kiwifyCode === 'auth_error') {
        throw new KiwifyAuthError(`Kiwify auth error on ${method} ${path}`);
      }

      const retryable = res.status === 429 || res.status >= 500;
      lastErr = new KiwifyApiError(
        `Kiwify API ${res.status} on ${method} ${path}`,
        res.status,
        kiwifyCode,
      );

      if (!retryable || attempt === this.maxRetries) {
        throw lastErr;
      }

      // Honor Retry-After when present (seconds), else exponential backoff + jitter.
      const retryAfter = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : this.backoffDelay(attempt);
      await this.sleep(delay);
    }

    throw lastErr ?? new KiwifyApiError(`Kiwify API failed on ${method} ${path}`, 0);
  }

  // ── Typed methods (AC5) ─────────────────────────────────────────────────────

  createWebhook(params: CreateWebhookParams): Promise<KiwifyWebhook> {
    return this.request<KiwifyWebhook>('POST', '/webhooks', { body: params });
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.request<void>('DELETE', `/webhooks/${encodeURIComponent(id)}`);
  }

  listProducts(params: ListProductsParams): Promise<KiwifyListResponse<KiwifyProduct>> {
    return this.request<KiwifyListResponse<KiwifyProduct>>('GET', '/products', {
      query: {
        page_size: params.page_size,
        page_number: params.page_number,
      },
    });
  }

  listSales(params: ListSalesParams): Promise<KiwifyListResponse<KiwifySale>> {
    return this.request<KiwifyListResponse<KiwifySale>>('GET', '/sales', {
      query: {
        start_date: params.start_date,
        end_date: params.end_date,
        updated_at_start_date: params.updated_at_start_date,
        updated_at_end_date: params.updated_at_end_date,
        status: params.status,
        payment_method: params.payment_method,
        product_id: params.product_id,
        page_size: params.page_size,
        page_number: params.page_number,
      },
    });
  }
}

// ── Supabase-backed store + factory ──────────────────────────────────────────

export interface KiwifyConnectionRow {
  id: string;
  account_id: string;
  client_id: string;
  client_secret_enc: string;
  access_token_enc: string | null;
  token_expires_at: string | null;
}

/**
 * Token store backed by `kiwify_connections`. Reads/writes the encrypted access token
 * via the canonical RPCs `app_decrypt_secret` / `app_encrypt_secret` (context
 * `'kiwify_'||account_id`). Never stores plaintext.
 */
export class SupabaseKiwifyStore implements KiwifyTokenStore {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly row: KiwifyConnectionRow,
  ) {}

  private get context(): string {
    return `kiwify_${this.row.account_id}`;
  }

  async load(): Promise<CachedToken> {
    if (!this.row.access_token_enc) {
      return { accessToken: null, expiresAt: null, scope: null };
    }
    const { data, error } = await this.supabase.rpc('app_decrypt_secret', {
      p_encrypted: this.row.access_token_enc,
      p_context: this.context,
    });
    if (error) {
      return { accessToken: null, expiresAt: null, scope: null };
    }
    return {
      accessToken: (data as string) ?? null,
      expiresAt: this.row.token_expires_at ? new Date(this.row.token_expires_at).getTime() : null,
      scope: null,
    };
  }

  async save(token: { accessToken: string; expiresAt: number; scope: string | null }): Promise<void> {
    const { data: enc } = await this.supabase.rpc('app_encrypt_secret', {
      p_value: token.accessToken,
      p_context: this.context,
    });
    await this.supabase
      .from('kiwify_connections')
      .update({
        access_token_enc: enc,
        token_expires_at: new Date(token.expiresAt).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.row.id);
  }
}

/**
 * Builds a KiwifyApiClient for a stored connection: decrypts `client_secret_enc`,
 * wires the Supabase-backed token store. `clientId` uses the stored `client_id` (a
 * distinct Kiwify OAuth UUID, NOT the account_id); override via `overrides.clientId`.
 * Base URL is overridable via the KIWIFY_BASE_URL env for tests.
 */
export async function createKiwifyClientForConnection(
  supabase: SupabaseClient,
  row: KiwifyConnectionRow,
  overrides: { clientId?: string; deps?: KiwifyClientDeps; baseUrl?: string } = {},
): Promise<KiwifyApiClient> {
  const context = `kiwify_${row.account_id}`;
  const { data: clientSecret, error } = await supabase.rpc('app_decrypt_secret', {
    p_encrypted: row.client_secret_enc,
    p_context: context,
  });
  if (error || !clientSecret) {
    throw new KiwifyAuthError('Could not resolve Kiwify client secret');
  }

  return new KiwifyApiClient({
    accountId: row.account_id,
    clientId: overrides.clientId ?? row.client_id,
    clientSecret: clientSecret as string,
    store: new SupabaseKiwifyStore(supabase, row),
    baseUrl: overrides.baseUrl ?? Deno.env.get('KIWIFY_BASE_URL') ?? DEFAULT_KIWIFY_BASE_URL,
    deps: overrides.deps,
  });
}
