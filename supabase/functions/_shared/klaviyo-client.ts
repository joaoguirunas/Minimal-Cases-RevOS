/**
 * KlaviyoClient — client mínimo da API Klaviyo (KLV-1).
 *
 * Base: https://a.klaviyo.com · Auth: `Authorization: Klaviyo-API-Key pk_...`
 * (chave privada) + header `revision` fixado.
 *
 * IMPORTANTE (developers.klaviyo.com): o Klaviyo NÃO tem endpoint de envio direto
 * de e-mail/SMS. O caminho sancionado para envio 1:1 disparado por sistema externo é:
 *   1. upsert do profile (Create or Update Profile — /api/profile-import/)
 *   2. Create Event (/api/events/) com uma métrica custom
 *   3. um Flow no Klaviyo disparado por essa métrica envia o e-mail/SMS,
 *      usando as propriedades do evento ({{ event.subject }}, {{ event.message }},
 *      {{ event.nome }}, ... ) no template.
 *
 * Este client cobre exatamente isso + um testAuth.
 */

import { TokenBucket } from './kiwify-client.ts';

export const KLAVIYO_BASE_URL = 'https://a.klaviyo.com';
export const KLAVIYO_REVISION = '2025-07-15';

export class KlaviyoAuthError extends Error {
  readonly code = 'auth_error';
  constructor(message: string) {
    super(message);
    this.name = 'KlaviyoAuthError';
  }
}

export class KlaviyoApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'KlaviyoApiError';
    this.status = status;
  }
}

type Json = Record<string, unknown>;

export interface KlaviyoProfileAttrs {
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  properties?: Json;
}

const MAX_RETRIES = 3;

/** Telefone BR → E.164 (+55DDD9XXXXXXXX). Devolve null se irreconhecível. */
/**
 * Trava de segurança de envios (KLV-4): TODO envio via Klaviyo (profile+evento →
 * flow) fica bloqueado a menos que `sends_locked` esteja EXPLICITAMENTE 'false'
 * nas credenciais do canal. Fail-safe: credencial recém-configurada = travada.
 * Sync de templates e bootstrap de flows (rascunho) não são envios — passam.
 */
export function isKlaviyoSendLocked(creds: Record<string, unknown> | null | undefined): boolean {
  const v = creds?.sends_locked;
  return !(v === false || v === 'false');
}

export const KLAVIYO_LOCKED_MSG =
  'Klaviyo: envios TRAVADOS (trava de segurança). Nada foi enviado — destrave o switch "Liberar envios" na aba Klaviyo do canal para enviar de verdade.';

export function toE164BR(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = '55' + d; // sem DDI
  if (d.length === 12 && d.startsWith('55')) d = d.slice(0, 4) + '9' + d.slice(4); // sem 9º dígito
  if (d.length === 13 && d.startsWith('55')) return '+' + d;
  return d.length >= 11 && d.length <= 15 ? '+' + d : null;
}

export class KlaviyoClient {
  private readonly bucket: TokenBucket;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly apiKey: string) {
    this.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Conservador vs. os limites do Klaviyo (events: 700/min steady).
    this.bucket = new TokenBucket(60, 60 / 60_000, Date.now, this.sleep);
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
      'revision': KLAVIYO_REVISION,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    };
  }

  async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: Json): Promise<T> {
    const url = `${KLAVIYO_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    let lastStatus = 0;
    let lastMessage = 'request failed';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.bucket.acquire();
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: this.headers(),
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(30_000),
        });
      } catch (e) {
        lastStatus = 0;
        lastMessage = `network error: ${(e as Error).message}`;
        if (attempt < MAX_RETRIES) { await this.sleep(1000 * 2 ** attempt); continue; }
        break;
      }
      if (res.status === 401 || res.status === 403) {
        throw new KlaviyoAuthError(`Klaviyo rejeitou a API key (HTTP ${res.status})`);
      }
      if (res.ok) {
        if (res.status === 202 || res.status === 204) return undefined as T;
        return await res.json().catch(() => undefined) as T;
      }
      lastStatus = res.status;
      lastMessage = await res.text().then((t) => t.slice(0, 300)).catch(() => res.statusText);
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await this.sleep(1500 * 2 ** attempt);
        continue;
      }
      break;
    }
    throw new KlaviyoApiError(`Klaviyo API error (HTTP ${lastStatus}): ${lastMessage}`, lastStatus);
  }

  /** Create or Update Profile (idempotente por email/phone). */
  upsertProfile(attrs: KlaviyoProfileAttrs): Promise<unknown> {
    return this.request('POST', '/api/profile-import/', {
      data: { type: 'profile', attributes: attrs as Json },
    });
  }

  /**
   * Create Event — dispara a métrica que o Flow do Klaviyo escuta.
   * `profile` precisa de email ou phone_number.
   */
  createEvent(opts: {
    metricName: string;
    profile: { email?: string; phone_number?: string };
    properties: Json;
    value?: number;
  }): Promise<unknown> {
    return this.request('POST', '/api/events/', {
      data: {
        type: 'event',
        attributes: {
          properties: opts.properties,
          time: new Date().toISOString(),
          ...(opts.value !== undefined ? { value: opts.value } : {}),
          metric: { data: { type: 'metric', attributes: { name: opts.metricName } } },
          profile: { data: { type: 'profile', attributes: opts.profile as Json } },
        },
      },
    });
  }

  // ── Metrics & Flows API ─────────────────────────────────────────────────

  /** Busca métrica por nome exato. Métricas só existem após o primeiro evento. */
  async findMetricByName(name: string): Promise<{ id: string } | null> {
    const filter = encodeURIComponent(`equals(name,"${name.replace(/"/g, '')}")`);
    const res = await this.request<{ data?: Array<{ id: string }> }>('GET', `/api/metrics/?filter=${filter}`);
    return res?.data?.[0] ?? null;
  }

  /** Busca flow por nome exato. */
  async findFlowByName(name: string): Promise<{ id: string } | null> {
    const filter = encodeURIComponent(`equals(name,"${name.replace(/"/g, '')}")`);
    const res = await this.request<{ data?: Array<{ id: string }> }>('GET', `/api/flows/?filter=${filter}`);
    return res?.data?.[0] ?? null;
  }

  /** Lista TODOS os flows com status e gatilho — leitura pura, para auditoria. */
  async listFlows(): Promise<Array<{ id: string; name: string; status: string; trigger_type: string | null; updated: string | null }>> {
    const out: Array<{ id: string; name: string; status: string; trigger_type: string | null; updated: string | null }> = [];
    // /api/flows aceita page[size] de 1 a 10 apenas.
    let url: string | null = '/api/flows/?page[size]=10';
    for (let guard = 0; url && guard < 60; guard++) {
      const res: { data?: Array<{ id: string; attributes?: Record<string, unknown> }>; links?: { next?: string | null } } =
        await this.request('GET', url);
      for (const f of res.data ?? []) {
        const at = f.attributes ?? {};
        out.push({
          id: f.id,
          name: String(at.name ?? ''),
          status: String(at.status ?? ''),
          trigger_type: (at.trigger_type as string | undefined) ?? null,
          updated: (at.updated as string | undefined) ?? null,
        });
      }
      const next = res.links?.next ?? null;
      url = next ? next.replace(KLAVIYO_BASE_URL, '') : null;
    }
    return out;
  }

  /** Lista os nomes dos templates — leitura pura, para detectar colisão de nome. */
  async listTemplateNames(): Promise<Array<{ id: string; name: string }>> {
    const out: Array<{ id: string; name: string }> = [];
    // /api/templates também limita page[size] a 10.
    let url: string | null = '/api/templates/?page[size]=10';
    for (let guard = 0; url && guard < 60; guard++) {
      const res: { data?: Array<{ id: string; attributes?: Record<string, unknown> }>; links?: { next?: string | null } } =
        await this.request('GET', url);
      for (const t of res.data ?? []) out.push({ id: t.id, name: String((t.attributes ?? {}).name ?? '') });
      const next = res.links?.next ?? null;
      url = next ? next.replace(KLAVIYO_BASE_URL, '') : null;
    }
    return out;
  }

  /**
   * Definição de um flow (GET /api/flows/{id} com additional-fields[flow]=definition):
   * revela os gatilhos (métrica/lista/segmento) e as ações. Leitura pura.
   */
  async getFlowDefinition(id: string): Promise<Record<string, unknown> | null> {
    const res = await this.request<{ data?: { attributes?: Record<string, unknown> } }>(
      'GET', `/api/flows/${id}/?additional-fields[flow]=definition`,
    );
    return (res.data?.attributes ?? null) as Record<string, unknown> | null;
  }

  /**
   * Dados da conta (GET /api/accounts/) — inclui o e-mail/nome de remetente
   * padrão e o endereço público. É a resposta para "qual é o meu remetente
   * verificado" sem caçar no painel. Leitura pura.
   */
  async getAccount(): Promise<Record<string, unknown> | null> {
    const res = await this.request<{ data?: Array<{ id: string; attributes?: Record<string, unknown> }> }>('GET', '/api/accounts/');
    const acc = res.data?.[0];
    if (!acc) return null;
    return { id: acc.id, ...(acc.attributes ?? {}) };
  }

  /** Lista métricas (nome + integração de origem) — leitura pura. */
  async listMetrics(): Promise<Array<{ id: string; name: string; integration: string | null }>> {
    // /api/metrics não aceita page[size] (400 'not a valid field').
    const res = await this.request<{ data?: Array<{ id: string; attributes?: Record<string, unknown> }> }>('GET', '/api/metrics/');
    return (res.data ?? []).map((m) => {
      const at = m.attributes ?? {};
      const integ = (at.integration as Record<string, unknown> | undefined)?.name;
      return { id: m.id, name: String(at.name ?? ''), integration: typeof integ === 'string' ? integ : null };
    });
  }

  /** Cria flow (POST /api/flows). Rate limit apertado: 1/s, 100/dia. */
  createFlow(name: string, definition: Record<string, unknown>): Promise<{ data?: { id: string } }> {
    return this.request('POST', '/api/flows/', {
      data: { type: 'flow', attributes: { name, definition } },
    });
  }

  // ── Templates API ───────────────────────────────────────────────────────

  /** Busca template por nome exato (GET /api/templates com filter equals). */
  async findTemplateByName(name: string): Promise<{ id: string } | null> {
    const filter = encodeURIComponent(`equals(name,"${name.replace(/"/g, '')}")`);
    const res = await this.request<{ data?: Array<{ id: string }> }>('GET', `/api/templates/?filter=${filter}`);
    return res?.data?.[0] ?? null;
  }

  /** Cria template HTML (POST /api/templates). Limite Klaviyo: 1000 templates via API. */
  createTemplate(name: string, html: string, text?: string): Promise<{ data?: { id: string } }> {
    return this.request('POST', '/api/templates/', {
      data: {
        type: 'template',
        attributes: { name, editor_type: 'CODE', html, ...(text ? { text } : {}) },
      },
    });
  }

  /** Atualiza o HTML de um template existente (PATCH /api/templates/{id}). */
  updateTemplate(id: string, name: string, html: string): Promise<unknown> {
    return this.request('PATCH', `/api/templates/${id}/`, {
      data: { type: 'template', id, attributes: { name, html } },
    });
  }

  /** Valida a API key. */
  async testAuth(): Promise<void> {
    await this.request('GET', '/api/accounts/');
  }
}
