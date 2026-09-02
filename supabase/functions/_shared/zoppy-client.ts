/**
 * ZoppyApiClient — client tipado da API Zoppy Partners (ZPY-1).
 *
 * Base: https://api-partners.zoppy.com.br
 * Auth (partners.zoppy.com.br/docs/authentication):
 *   Authorization: Bearer <token>   (menu "Chave de API" na plataforma Zoppy)
 *   zoppy-access: <chave>           (fornecida pelo time de tecnologia da Zoppy)
 *
 * Listas paginadas: query `after` (ISO 8601), `page` (1-based), `pageSize`;
 * `updatedAt` opcional para sync incremental.
 *
 * Rate limit não documentado — aplicamos token bucket conservador (60 req/min)
 * + backoff exponencial com jitter para 429/5xx. 401/403 → ZoppyAuthError.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TokenBucket } from './kiwify-client.ts';

export const ZOPPY_BASE_URL = 'https://api-partners.zoppy.com.br';

export type ZoppyResource = 'customers' | 'orders' | 'abandoned-carts';
export const ZOPPY_RESOURCES: readonly ZoppyResource[] = ['customers', 'orders', 'abandoned-carts'];

// ── Pipelines do import (ZPY-3) — resolvidos por nome pelo zoppy-sync ────────

export const ZOPPY_CUSTOMERS_PIPELINE = 'Clientes';
export const ZOPPY_CARTS_PIPELINE = 'Carrinho Abandonado';
export const ZOPPY_CARTS_ENTRY_STAGE = 'Carrinho abandonado';

/** position (RFM da Zoppy) → nome do stage no pipeline Clientes. */
export const RFM_TO_STAGE: Record<string, string> = {
  'promising': 'Promissores',
  'possible-loyal': 'Possíveis fiéis',
  'loyal': 'Fiéis',
  'at-risk': 'Em risco',
  'sleeping': 'Dormindo',
};
export const RFM_FALLBACK_STAGE = 'Sem classificação';

// ── Errors ───────────────────────────────────────────────────────────────────

export class ZoppyAuthError extends Error {
  readonly code = 'auth_error';
  constructor(message: string) {
    super(message);
    this.name = 'ZoppyAuthError';
  }
}

export class ZoppyApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ZoppyApiError';
    this.status = status;
  }
}

// ── Types (subconjunto consumido pelo CRM; raw é sempre persistido) ──────────

type Json = Record<string, unknown>;

export interface ZoppyCustomer {
  id: string;
  externalId?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  /** Segmentação RFM (read-only): promising, loyal, sleeping, possible-loyal, at-risk */
  position?: string | null;
  address?: Json | null;
  coupon?: Json | null;
  customFields?: unknown[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [k: string]: unknown;
}

export interface ZoppyOrder {
  id: string;
  externalId?: string | null;
  status?: string | null;
  subtotal?: number | null;
  total?: number | null;
  discount?: number | null;
  shipping?: number | null;
  couponCode?: string | null;
  completedAt?: string | null;
  provider?: string | null;
  customerId?: string | null;
  customer?: ZoppyCustomer | null;
  lineItems?: unknown[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [k: string]: unknown;
}

export interface ZoppyAbandonedCart {
  id: string;
  externalId?: string | null;
  url?: string | null;
  subtotal?: number | null;
  total?: number | null;
  discount?: number | null;
  shipping?: number | null;
  customerId?: string | null;
  customer?: ZoppyCustomer | null;
  lineItems?: unknown[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [k: string]: unknown;
}

export interface ZoppyConnectionRow {
  id: string;
  api_token_enc: string;
  zoppy_access_enc: string;
  status: string;
  last_error: string | null;
}

export interface ZoppyListParams {
  after?: string;
  page?: number;
  pageSize?: number;
  updatedAt?: string;
}

// ── Client ───────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

export class ZoppyApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly bucket: TokenBucket;

  constructor(
    private readonly creds: { apiToken: string; zoppyAccess: string },
    deps: { fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {},
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    const now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = deps.random ?? Math.random;
    this.bucket = new TokenBucket(60, 60 / 60_000, now, this.sleep);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.creds.apiToken}`,
      'zoppy-access': this.creds.zoppyAccess,
    };
  }

  async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: { query?: Record<string, string>; body?: Json } = {}): Promise<T> {
    const url = new URL(`${ZOPPY_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
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
        if (attempt < MAX_RETRIES) { await this.backoff(attempt); continue; }
        break;
      }

      if (res.status === 401 || res.status === 403) {
        throw new ZoppyAuthError(`Zoppy rejeitou as credenciais (HTTP ${res.status})`);
      }
      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return await res.json() as T;
      }

      lastStatus = res.status;
      lastMessage = await res.text().then((t) => t.slice(0, 300)).catch(() => res.statusText);
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await this.backoff(attempt);
        continue;
      }
      break;
    }
    throw new ZoppyApiError(`Zoppy API error (HTTP ${lastStatus}): ${lastMessage}`, lastStatus);
  }

  private async backoff(attempt: number): Promise<void> {
    const base = 1000 * Math.pow(2, attempt);
    await this.sleep(base + this.random() * base);
  }

  /**
   * Lista paginada de qualquer recurso. A resposta pode vir como array puro ou
   * envelopada ({ data | items | results }) — normalizamos para array.
   */
  async list<T>(resource: ZoppyResource, params: ZoppyListParams = {}): Promise<T[]> {
    const query: Record<string, string> = {
      after: params.after ?? '2000-01-01',
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 100),
    };
    if (params.updatedAt) query.updatedAt = params.updatedAt;
    const res = await this.request<unknown>('GET', `/${resource}/`, { query });
    if (Array.isArray(res)) return res as T[];
    const rec = res as Json;
    for (const key of ['data', 'items', 'results', 'rows']) {
      if (Array.isArray(rec?.[key])) return rec[key] as T[];
    }
    return [];
  }

  /** Valida credenciais com a menor chamada possível. */
  async testAuth(): Promise<void> {
    await this.list<ZoppyCustomer>('customers', { page: 1, pageSize: 1 });
  }
}

// ── Supabase-bound factory ────────────────────────────────────────────────────

const ENC_CONTEXT = 'zoppy_main';

export async function loadZoppyConnection(supabase: SupabaseClient): Promise<ZoppyConnectionRow | null> {
  const { data } = await supabase
    .from('zoppy_connections')
    .select('id, api_token_enc, zoppy_access_enc, status, last_error')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ZoppyConnectionRow | null) ?? null;
}

async function decrypt(supabase: SupabaseClient, encrypted: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('app_decrypt_secret', {
    p_encrypted: encrypted,
    p_context: ENC_CONTEXT,
  });
  if (error) return null;
  return (data as string) ?? null;
}

export async function createZoppyClientForConnection(
  supabase: SupabaseClient,
  row?: ZoppyConnectionRow | null,
): Promise<{ client: ZoppyApiClient; row: ZoppyConnectionRow } | null> {
  const conn = row ?? await loadZoppyConnection(supabase);
  if (!conn) return null;
  const apiToken = await decrypt(supabase, conn.api_token_enc);
  const zoppyAccess = await decrypt(supabase, conn.zoppy_access_enc);
  if (!apiToken || !zoppyAccess) return null;
  return { client: new ZoppyApiClient({ apiToken, zoppyAccess }), row: conn };
}

export const ZOPPY_ENC_CONTEXT = ENC_CONTEXT;
