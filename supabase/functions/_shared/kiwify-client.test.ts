/**
 * Tests for KiwifyApiClient (KFY-1.2) — rate limiter + token cache/refresh + retries.
 *
 * Run: deno test --allow-net --allow-env \
 *   supabase/functions/_shared/kiwify-client.test.ts
 *
 * No real network: `fetch` is injected. A fake clock/sleep drives the token bucket and
 * backoff deterministically. The token store is an in-memory fake.
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  type CachedToken,
  KiwifyApiClient,
  KiwifyApiError,
  KiwifyAuthError,
  type KiwifyClientConfig,
  type KiwifyClientDeps,
  type KiwifyTokenStore,
  TokenBucket,
} from './kiwify-client.ts';

// ── Fakes ────────────────────────────────────────────────────────────────────

class FakeClock {
  t = 1_000_000;
  now = () => this.t;
  advance(ms: number) {
    this.t += ms;
  }
  /** sleep that advances the clock instead of waiting real time. */
  sleep = (ms: number) => {
    this.t += ms;
    return Promise.resolve();
  };
}

class MemoryStore implements KiwifyTokenStore {
  saved: { accessToken: string; expiresAt: number; scope: string | null } | null = null;
  constructor(private initial: CachedToken = { accessToken: null, expiresAt: null, scope: null }) {}
  load(): Promise<CachedToken> {
    return Promise.resolve(this.initial);
  }
  save(token: { accessToken: string; expiresAt: number; scope: string | null }): Promise<void> {
    this.saved = token;
    return Promise.resolve();
  }
}

interface StubResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** Builds a fetch stub that returns queued responses in order and records calls. */
function stubFetch(responses: StubResponse[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const impl = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    const noBody = r.status === 204 || r.status === 205 || r.status === 304;
    const res = new Response(noBody ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'Content-Type': 'application/json', ...(r.headers ?? {}) },
    });
    return Promise.resolve(res);
  }) as unknown as typeof fetch;
  return { impl, calls, count: () => i };
}

const TOKEN_OK: StubResponse = {
  status: 200,
  body: { access_token: 'tok_abc', token_type: 'Bearer', expires_in: '86400', scope: 'sales products webhooks' },
};

function makeClient(
  fetchImpl: typeof fetch,
  clock: FakeClock,
  store: KiwifyTokenStore,
  extra: Partial<KiwifyClientConfig> = {},
): KiwifyApiClient {
  const deps: KiwifyClientDeps = {
    fetchImpl,
    now: clock.now,
    sleep: clock.sleep,
    random: () => 0.5, // deterministic jitter
  };
  return new KiwifyApiClient({
    accountId: 'acc_1',
    clientId: 'acc_1',
    clientSecret: 'secret_xyz',
    store,
    baseUrl: 'https://api.test/v1',
    deps,
    ...extra,
  });
}

// ── TokenBucket ──────────────────────────────────────────────────────────────

Deno.test('TokenBucket: allows up to capacity immediately, then throttles', async () => {
  const clock = new FakeClock();
  // capacity 2, refill 2/min => 1 token every 30s.
  const bucket = new TokenBucket(2, 2 / 60_000, clock.now, clock.sleep);

  assertEquals(bucket.msUntilAvailable(), 0);
  await bucket.acquire();
  await bucket.acquire();

  // Bucket empty now; next token needs ~30s.
  assertEquals(bucket.msUntilAvailable(), 30_000);

  const before = clock.t;
  await bucket.acquire(); // sleeps 30s via fake clock
  assertEquals(clock.t - before, 30_000);
});

Deno.test('TokenBucket: refills over time up to capacity', async () => {
  const clock = new FakeClock();
  const bucket = new TokenBucket(5, 5 / 60_000, clock.now, clock.sleep);
  for (let i = 0; i < 5; i++) await bucket.acquire();
  assertEquals(bucket.msUntilAvailable() > 0, true);
  clock.advance(60_000); // full refill window
  assertEquals(bucket.msUntilAvailable(), 0);
});

// ── OAuth token cache ────────────────────────────────────────────────────────

Deno.test('getToken: fetches once and caches; reuses within TTL', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore();
  const f = stubFetch([TOKEN_OK]);
  const client = makeClient(f.impl, clock, store);

  const t1 = await client.getToken();
  const t2 = await client.getToken();

  assertEquals(t1, 'tok_abc');
  assertEquals(t2, 'tok_abc');
  assertEquals(f.count(), 1); // only one OAuth call
  assertEquals(client.grantedScope, 'sales products webhooks');
  assertExists(store.saved);
  assertEquals(store.saved!.accessToken, 'tok_abc');
  // expiresAt derived from expires_in at runtime (86400s), NOT hardcoded.
  assertEquals(store.saved!.expiresAt, clock.now() + 86_400_000);
});

Deno.test('getToken: normalizes array-format scope + numeric expires_in (real Kiwify response)', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore();
  // Real /oauth/token: scope is a JSON array of strings and expires_in a number.
  const realShape: StubResponse = {
    status: 200,
    body: {
      access_token: 'tok_real',
      token_type: 'Bearer',
      expires_in: 86400,
      scope: ['sales', 'events', 'webhooks', 'affiliates', 'stats', 'sales_refund', 'products', 'financial'],
    },
  };
  const f = stubFetch([realShape]);
  const client = makeClient(f.impl, clock, store);

  await client.getToken();

  assertEquals(
    client.grantedScope,
    'sales events webhooks affiliates stats sales_refund products financial',
  );
  assertExists(store.saved);
  assertEquals(store.saved!.scope, client.grantedScope);
  assertEquals(store.saved!.expiresAt, clock.now() + 86_400_000);
});

Deno.test('getToken: proactively refreshes when <25% of TTL remains', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore();
  const second: StubResponse = { ...TOKEN_OK, body: { ...(TOKEN_OK.body as object), access_token: 'tok_2' } };
  const f = stubFetch([TOKEN_OK, second]);
  const client = makeClient(f.impl, clock, store);

  await client.getToken(); // issues tok_abc, ttl 86400s
  // Advance to 80% elapsed → 20% remaining (< 25% margin) → refresh.
  clock.advance(Math.floor(86_400_000 * 0.8));
  const t = await client.getToken();

  assertEquals(t, 'tok_2');
  assertEquals(f.count(), 2);
});

Deno.test('getToken: does NOT refresh while comfortably within TTL', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore();
  const f = stubFetch([TOKEN_OK]);
  const client = makeClient(f.impl, clock, store);

  await client.getToken();
  clock.advance(Math.floor(86_400_000 * 0.5)); // 50% remaining
  await client.getToken();

  assertEquals(f.count(), 1);
});

Deno.test('getToken: uses cached token from store without a network call', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({
    accessToken: 'stored_tok',
    expiresAt: clock.now() + 3_600_000, // 1h out
    scope: null,
  });
  const f = stubFetch([TOKEN_OK]);
  const client = makeClient(f.impl, clock, store);

  const t = await client.getToken();
  assertEquals(t, 'stored_tok');
  assertEquals(f.count(), 0);
});

Deno.test('getToken: concurrent callers share a single in-flight refresh', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore();
  const f = stubFetch([TOKEN_OK]);
  const client = makeClient(f.impl, clock, store);

  const [a, b, c] = await Promise.all([client.getToken(), client.getToken(), client.getToken()]);
  assertEquals([a, b, c], ['tok_abc', 'tok_abc', 'tok_abc']);
  assertEquals(f.count(), 1);
});

Deno.test('getToken: auth_error (HTTP 400) throws KiwifyAuthError, no retry', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore();
  const f = stubFetch([
    { status: 400, body: { error: 'auth_error', message: 'Invalid client: client is invalid' } },
  ]);
  const client = makeClient(f.impl, clock, store);

  await assertRejects(() => client.getToken(), KiwifyAuthError);
  assertEquals(f.count(), 1); // never retried
});

// ── Request path: retries + auth ─────────────────────────────────────────────

Deno.test('listSales: retries on 429 then succeeds', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({ accessToken: 'tok', expiresAt: clock.now() + 3_600_000, scope: null });
  const salesOk: StubResponse = {
    status: 200,
    body: { pagination: { count: 1, page_number: 1, page_size: 100 }, data: [{ id: 's1', net_amount: 12048 }] },
  };
  const f = stubFetch([
    { status: 429, body: { error: 'rate_limited' } },
    salesOk,
  ]);
  const client = makeClient(f.impl, clock, store, { backoffBaseMs: 100 });

  const res = await client.listSales({ start_date: '2026-01-01', end_date: '2026-01-31', page_size: 100, page_number: 1 });
  assertEquals(res.data[0].id, 's1');
  assertEquals(res.data[0].net_amount, 12048); // centavos preserved
  assertEquals(f.count(), 2);
});

Deno.test('listSales: honors Retry-After header on 429', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({ accessToken: 'tok', expiresAt: clock.now() + 3_600_000, scope: null });
  const salesOk: StubResponse = { status: 200, body: { pagination: {}, data: [] } };
  const f = stubFetch([
    { status: 429, body: {}, headers: { 'retry-after': '3' } },
    salesOk,
  ]);
  const client = makeClient(f.impl, clock, store);

  const before = clock.t;
  await client.listSales({ start_date: '2026-01-01', end_date: '2026-01-31', page_size: 100, page_number: 1 });
  // Slept 3s from Retry-After (rate-limit token acquisition is instant here).
  assertEquals(clock.t - before, 3000);
});

Deno.test('listProducts: retries on 5xx up to maxRetries then throws KiwifyApiError', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({ accessToken: 'tok', expiresAt: clock.now() + 3_600_000, scope: null });
  const f = stubFetch([{ status: 500, body: { error: 'server_error' } }]);
  const client = makeClient(f.impl, clock, store, { maxRetries: 3, backoffBaseMs: 10 });

  const err = await assertRejects(
    () => client.listProducts({ page_size: 50, page_number: 1 }),
    KiwifyApiError,
  );
  assertEquals(err.status, 500);
  assertEquals(f.count(), 3);
});

Deno.test('request: auth_error mid-call throws KiwifyAuthError without retry', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({ accessToken: 'tok', expiresAt: clock.now() + 3_600_000, scope: null });
  const f = stubFetch([{ status: 400, body: { error: 'auth_error', message: 'nope' } }]);
  const client = makeClient(f.impl, clock, store);

  await assertRejects(
    () => client.listProducts({ page_size: 50, page_number: 1 }),
    KiwifyAuthError,
  );
  assertEquals(f.count(), 1);
});

Deno.test('request: sends Bearer token + x-kiwify-account-id headers', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({ accessToken: 'tok_hdr', expiresAt: clock.now() + 3_600_000, scope: null });
  const f = stubFetch([{ status: 200, body: { pagination: {}, data: [] } }]);
  const client = makeClient(f.impl, clock, store);

  await client.listProducts({ page_size: 10, page_number: 1 });
  const headers = f.calls[0].init!.headers as Record<string, string>;
  assertEquals(headers['Authorization'], 'Bearer tok_hdr');
  assertEquals(headers['x-kiwify-account-id'], 'acc_1');
});

Deno.test('createWebhook: posts products as single string and triggers as array', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({ accessToken: 'tok', expiresAt: clock.now() + 3_600_000, scope: null });
  const f = stubFetch([{ status: 200, body: { id: 'wh_1' } }]);
  const client = makeClient(f.impl, clock, store);

  const wh = await client.createWebhook({
    name: 'CRM',
    url: 'https://crm.test/kiwify-inbound',
    products: 'all',
    triggers: ['compra_aprovada', 'pix_gerado'],
    token: 'whsec',
  });
  assertEquals(wh.id, 'wh_1');
  const sent = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(sent.products, 'all'); // string, not array
  assertEquals(Array.isArray(sent.triggers), true);
});

Deno.test('deleteWebhook: issues DELETE and tolerates 204', async () => {
  const clock = new FakeClock();
  const store = new MemoryStore({ accessToken: 'tok', expiresAt: clock.now() + 3_600_000, scope: null });
  const f = stubFetch([{ status: 204, body: {} }]);
  const client = makeClient(f.impl, clock, store);

  await client.deleteWebhook('wh_1');
  assertEquals(f.calls[0].init!.method, 'DELETE');
  assertEquals(f.calls[0].url.endsWith('/webhooks/wh_1'), true);
});
