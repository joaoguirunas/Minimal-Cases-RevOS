/**
 * Evolution API REST Client — Evolution API v2.3.7 (self-hosted, engine Baileys)
 *
 * Wrapper para a REST API do Evolution API. Portado da implementação do Ora
 * (mesma base de produto), adaptado de per-user pra TENANT-WIDE: não existe
 * `owner_user_id`/instância-por-usuário aqui — a instância é única, configurada
 * uma vez em Integrações, e todo o CRM manda/recebe por ela, igual ao canal
 * Meta oficial.
 *
 * Este módulo é o ponto onde a divergência de API Evolution↔Meta fica ISOLADA.
 * Tudo que diverge (auth `apikey`, paths com instance no path, `number` sem
 * `@c.us`, `mediatype` único, QR inline, estados open/connecting/close) vive
 * aqui e NÃO vaza pro resto do sistema (whatsapp-outbound, evolution-webhook).
 *
 * Padrões deste módulo:
 * - Toda chamada retorna `EvolutionResult<T>` — nunca throw para o caller.
 * - Reads idempotentes (connectionState) tem retry exponencial em 5xx/timeout.
 *   Writes (sendText/etc.) NÃO retentam — idempotência é do caller via
 *   `wa_message_id` (= `key.id` do Evolution).
 * - Evolution NÃO tem HMAC. `verifyEvolutionWebhookAuth` compara constant-time
 *   um token de header custom — prova de ORIGEM, não de integridade do payload.
 * - A tradução de estado `open/connecting/close` → vocabulário canônico
 *   (STOPPED/STARTING/SCAN_QR_CODE/WORKING/FAILED/BANNED) vive SÓ aqui
 *   (`toCanonicalStatus`) — persiste em `settings_whatsapp_channels.evolution_status`.
 *
 * Config vive em `settings_whatsapp_channels` (linha única `provider='evolution'`),
 * não num singleton separado — mesma tabela que já guarda os canais Meta.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type Logger } from './logger.ts';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type EvolutionErrorCode =
  | 'EVO_AUTH'         // 401/403
  | 'EVO_NOT_FOUND'    // 404
  | 'EVO_VALIDATION'   // 400/422
  | 'EVO_RATE_LIMIT'   // 429
  | 'EVO_SERVER'       // 5xx
  | 'EVO_TIMEOUT'      // AbortController fired
  | 'EVO_NETWORK'      // fetch throw (DNS, conn refused, etc.)
  | 'EVO_UNKNOWN';     // any other non-2xx sem categoria definida

export interface EvolutionSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export interface EvolutionFailure {
  ok: false;
  status: number;
  error: EvolutionErrorCode;
  message?: string;
  data?: unknown;
}

export type EvolutionResult<T> = EvolutionSuccess<T> | EvolutionFailure;

/**
 * Estado cru de conexão que a Evolution v2.3.7 retorna em
 * `GET /instance/connectionState/{instance}` e no evento `connection.update`.
 * NÃO há `SCAN_QR_CODE`/`FAILED` nativos.
 */
export type EvolutionConnectionState = 'open' | 'connecting' | 'close';

/**
 * Vocabulário canônico. O DB (`evolution_status`), a UI e o outbound usam SÓ
 * este vocabulário — nunca o cru `open/connecting/close`.
 */
export type CanonicalSessionStatus =
  | 'STOPPED'
  | 'STARTING'
  | 'SCAN_QR_CODE'
  | 'WORKING'
  | 'FAILED'
  | 'BANNED';

/**
 * Traduz o estado cru Evolution para o vocabulário canônico. Esta tradução
 * vive SÓ aqui — evita espalhar `if state==='open'` pelo resto do sistema.
 *
 * - `open` → `WORKING`
 * - `connecting` → `SCAN_QR_CODE` se há QR pendente, senão `STARTING`
 * - `close` → `STOPPED`
 * - estado desconhecido / erro → `FAILED`
 */
export function toCanonicalStatus(
  state: EvolutionConnectionState | string | null | undefined,
  hasPendingQr = false,
): CanonicalSessionStatus {
  switch (state) {
    case 'open':
      return 'WORKING';
    case 'connecting':
      return hasPendingQr ? 'SCAN_QR_CODE' : 'STARTING';
    case 'close':
      return 'STOPPED';
    default:
      return 'FAILED';
  }
}

/**
 * Eventos que `evolution-webhook/index.ts` processa. Mantenha sincronizada
 * com o switch do handler.
 *
 * IMPORTANTE (Evolution v2.3.7): ao SETAR o webhook (`/webhook/set`), os
 * eventos têm que estar em UPPERCASE_SNAKE — nesse formato o servidor os
 * reconhece e ativa. Em lowercase.dotted o Evolution ARMAZENA mas NÃO
 * reconhece → zero entrega. O PAYLOAD recebido, por outro lado, traz `event`
 * em lowercase.dotted — por isso o handler faz match em lowercase. Dois
 * vocabulários distintos.
 */
export const EVOLUTION_WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',   // inbound de cliente (+ eco fromMe=true)
  'MESSAGES_UPDATE',   // ACK de status (SERVER_ACK/DELIVERY_ACK/READ/PLAYED)
  'CONNECTION_UPDATE', // mudança de status da sessão (open/connecting/close)
  'QRCODE_UPDATED',    // QR atualizado (push)
  'MESSAGES_DELETE',   // mensagem revogada/apagada
] as const;

/**
 * Config de webhook da instância. `byEvents:false` mantém URL única;
 * `base64:true` faz o servidor entregar mídia já em base64. `headers.authorization`
 * carrega o token de mitigação (sem HMAC).
 */
export interface EvolutionWebhookConfig {
  url: string;
  events: string[];
  byEvents?: boolean;
  base64?: boolean;
  headers?: Record<string, string>;
}

/**
 * Constrói o `EvolutionWebhookConfig` apontando pro edge fn `evolution-webhook`
 * do projeto Supabase atual. `webhookToken` é o
 * `settings_whatsapp_channels.evolution_webhook_token` (mitigação sem-HMAC).
 * `pathSecret`, quando fornecido, é anexado à URL como defesa em profundidade.
 */
export function buildEvolutionWebhookConfig(params: {
  supabaseUrl: string;
  webhookToken: string;
  pathSecret?: string;
  events?: readonly string[];
  base64?: boolean;
}): EvolutionWebhookConfig {
  const base = params.supabaseUrl.replace(/\/+$/, '');
  const path = params.pathSecret
    ? `/functions/v1/evolution-webhook/${encodeURIComponent(params.pathSecret)}`
    : `/functions/v1/evolution-webhook`;
  return {
    url: `${base}${path}`,
    events: [...(params.events ?? EVOLUTION_WEBHOOK_EVENTS)],
    byEvents: false,
    base64: params.base64 ?? true,
    headers: { authorization: `Bearer ${params.webhookToken}` },
  };
}

/** Resposta de `POST /instance/create`. */
export interface EvolutionInstance {
  instanceName?: string;
  hash?: string;
  state?: EvolutionConnectionState | string;
  [key: string]: unknown;
}

/**
 * Resposta de `GET /instance/connect/{instance}`. QR INLINE — `base64` já vem
 * `data:image/png;base64,...` pronto p/ `<img src>`, sem segundo fetch e sem
 * poll. `pairingCode` é o fallback de pareamento por código.
 */
export interface EvolutionConnectResult {
  code?: string;
  base64?: string;
  pairingCode?: string;
  count?: number;
  [key: string]: unknown;
}

/** Resposta de `GET /instance/connectionState/{instance}`. */
export interface EvolutionConnectionStateResult {
  instance?: { instanceName?: string; state?: EvolutionConnectionState | string };
  [key: string]: unknown;
}

/** Resposta de envio (`/message/sendText|sendMedia|sendWhatsAppAudio`). `key.id` = wa_message_id. */
export interface EvolutionSendResult {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  status?: string;
  message?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Evento de webhook Evolution (envelope top-level). Os campos de `data`
 * variam por `event`; o caller faz narrowing.
 */
export interface EvolutionWebhookEvent<D = Record<string, unknown>> {
  event: string;
  instance?: string;
  data?: D;
  sender?: string;
  server_url?: string;
  apikey?: string;
  date_time?: string;
}

export interface EvolutionError {
  code: EvolutionErrorCode;
  status: number;
  message?: string;
  data?: unknown;
}

export interface EvolutionClientConfig {
  baseUrl: string;       // ex.: https://evolution.example.com
  apiKey: string;        // header `apikey` (global AUTHENTICATION_API_KEY)
  timeoutMs?: number;    // default 30000ms
  maxReadRetries?: number; // default 3; só aplica em métodos de leitura
  logger?: Logger;
}

export interface EvolutionInstanceCreateOpts {
  webhook?: EvolutionWebhookConfig;
  token?: string;
  /** `integration` — default `WHATSAPP-BAILEYS`. */
  integration?: string;
}

/** Discriminador de mídia (colapsa os 4 métodos possíveis num endpoint). */
export type EvolutionMediaType = 'image' | 'video' | 'document';

export interface SendTextInput {
  instance: string;
  /** Só dígitos (`5511999999999`) — Evolution adiciona `@s.whatsapp.net`. */
  to: string;
  text: string;
  quoted?: string;
  linkPreview?: boolean;
  delay?: number;
}

export interface SendMediaInput {
  instance: string;
  to: string;
  mediatype: EvolutionMediaType;
  media: string; // URL pública OU base64
  caption?: string;
  fileName?: string;
  delay?: number;
}

export interface SendAudioInput {
  instance: string;
  to: string;
  audio: string; // URL pública OU base64 (OGG/PTT — render como voice note)
  delay?: number;
}

export interface EvolutionClient {
  instances: {
    /** `POST /instance/create` — cria instância (engine Baileys), webhook opcional. */
    create(
      instanceName: string,
      opts?: EvolutionInstanceCreateOpts,
    ): Promise<EvolutionResult<EvolutionInstance>>;
    /** `GET /instance/connect/{instance}` — o "start". Retorna QR INLINE. */
    connect(instanceName: string): Promise<EvolutionResult<EvolutionConnectResult>>;
    /** `GET /instance/connectionState/{instance}` — estado cru open/connecting/close. */
    connectionState(instanceName: string): Promise<EvolutionResult<EvolutionConnectionStateResult>>;
    /** `DELETE /instance/logout/{instance}` — desfaz pareamento (state→close). */
    logout(instanceName: string): Promise<EvolutionResult<unknown>>;
    /** `DELETE /instance/delete/{instance}` — remove a instância. */
    delete(instanceName: string): Promise<EvolutionResult<unknown>>;
    /** `POST /instance/restart/{instance}` — reinicia o socket Baileys. */
    restart(instanceName: string): Promise<EvolutionResult<unknown>>;
  };
  webhook: {
    /** `POST /webhook/set/{instance}` — (re)configura webhook. */
    set(instanceName: string, config: EvolutionWebhookConfig): Promise<EvolutionResult<unknown>>;
    /** `GET /webhook/find/{instance}` — lê a config atual de webhook. */
    find(instanceName: string): Promise<EvolutionResult<unknown>>;
  };
  messages: {
    sendText(input: SendTextInput): Promise<EvolutionResult<EvolutionSendResult>>;
    sendMedia(input: SendMediaInput): Promise<EvolutionResult<EvolutionSendResult>>;
    sendAudio(input: SendAudioInput): Promise<EvolutionResult<EvolutionSendResult>>;
  };
}

// ── Helpers públicos ─────────────────────────────────────────────────────────

/**
 * Normaliza telefone BR para o `number` do Evolution: só DÍGITOS, sem `@c.us`
 * (Evolution adiciona `@s.whatsapp.net` internamente).
 *
 * Números BR de 12 dígitos (`55DD8digits`, móveis antigos sem o "9") recebem
 * o "9" na posição 4. Sem código de país, prepende `55` (BR) por default.
 */
export function formatRecipient(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  let normalized = digits;
  if (digits.length === 10 || digits.length === 11) {
    normalized = '55' + digits;
  }
  if (normalized.length === 12 && normalized.startsWith('55')) {
    normalized = normalized.substring(0, 4) + '9' + normalized.substring(4);
  }
  return normalized;
}

/**
 * Verificação de webhook Evolution — Evolution v2.3.7 NÃO tem HMAC (sem
 * assinatura do body). A mitigação é um token custom em header
 * (`authorization`) configurado no `/webhook/set` e comparado em constant-time
 * aqui. Prova de ORIGEM, não de integridade do payload.
 *
 * Retorna `false` (não throw) para qualquer entrada inválida. Aceita o
 * formato `Bearer <token>` (strip do prefixo) para casar com
 * `buildEvolutionWebhookConfig`.
 */
export function verifyEvolutionWebhookAuth(params: {
  headerToken: string | null | undefined;
  expectedToken: string | null | undefined;
}): boolean {
  const { headerToken, expectedToken } = params;
  if (!headerToken || !expectedToken) return false;

  const received = headerToken.startsWith('Bearer ')
    ? headerToken.slice(7)
    : headerToken;

  if (received.length !== expectedToken.length) return false;

  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Constrói data URL pronta para `<img src=...>` a partir do `base64` do connect.
 * Evolution já entrega `data:image/png;base64,...` inline; tolerante a base64
 * puro (adiciona o prefixo) ou já-prefixado (passa direto). `null` se não há
 * QR utilizável.
 */
export function qrToDataUrl(connect: EvolutionConnectResult | null | undefined): string | null {
  if (!connect?.base64) return null;
  const b64 = connect.base64;
  if (b64.startsWith('data:')) return b64;
  return `data:image/png;base64,${b64.replace(/^base64,/, '')}`;
}

/**
 * Config do canal Evolution (linha única em `settings_whatsapp_channels`).
 * DB-first, sem ENV fallback. Throw se a linha não existir, estiver inativa,
 * ou faltar algum campo obrigatório.
 */
export interface EvolutionChannelConfig {
  channelId: string;
  baseUrl: string;
  apiKey: string;
  webhookToken: string;
  instanceName: string;
  status: string | null;
}

export async function loadEvolutionChannelConfig(
  supabase: SupabaseClient,
): Promise<EvolutionChannelConfig> {
  const { data, error } = await supabase
    .from('settings_whatsapp_channels')
    .select('id, evolution_base_url, evolution_api_key, evolution_webhook_token, evolution_instance_name, evolution_status, active')
    .eq('provider', 'evolution')
    .maybeSingle();

  if (error) {
    throw new Error(`loadEvolutionChannelConfig: ${error.message}`);
  }
  if (!data) {
    throw new Error('loadEvolutionChannelConfig: nenhum canal provider=evolution configurado');
  }
  if (!data.active) {
    throw new Error('loadEvolutionChannelConfig: canal evolution está inativo');
  }
  if (!data.evolution_base_url || !data.evolution_api_key || !data.evolution_webhook_token || !data.evolution_instance_name) {
    throw new Error('loadEvolutionChannelConfig: campos evolution_* incompletos');
  }

  return {
    channelId: data.id as string,
    baseUrl: String(data.evolution_base_url).replace(/\/+$/, ''),
    apiKey: String(data.evolution_api_key),
    webhookToken: String(data.evolution_webhook_token),
    instanceName: String(data.evolution_instance_name),
    status: (data.evolution_status as string | null) ?? null,
  };
}

/**
 * Helper de conveniência para edge fns: usa service role (via ENV `SUPABASE_URL`
 * + `SUPABASE_SERVICE_ROLE_KEY`) somente para LER o canal. A config Evolution
 * em si é SEMPRE DB-first — nunca de ENV.
 */
export async function createEvolutionClientFromDb(opts?: {
  timeoutMs?: number;
  maxReadRetries?: number;
  logger?: Logger;
}): Promise<{ client: EvolutionClient; channel: EvolutionChannelConfig }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('createEvolutionClientFromDb: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const channel = await loadEvolutionChannelConfig(supabase);
  const client = createEvolutionClient({
    baseUrl: channel.baseUrl,
    apiKey: channel.apiKey,
    timeoutMs: opts?.timeoutMs,
    maxReadRetries: opts?.maxReadRetries,
    logger: opts?.logger,
  });
  return { client, channel };
}

// ── Internos ─────────────────────────────────────────────────────────────────

// Timeout default 30s alinhado ao edge budget (60s). Override via
// `EVOLUTION_HTTP_TIMEOUT_MS` env. Clamp 1s..55s para headroom no edge.
function envTimeoutMs(): number {
  try {
    const raw = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env?.get?.('EVOLUTION_HTTP_TIMEOUT_MS');
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return 30_000;
    return Math.min(55_000, Math.max(1_000, parsed));
  } catch {
    return 30_000;
  }
}
const DEFAULT_MAX_READ_RETRIES = 3;
const READ_BACKOFF_MS = [500, 1_000, 2_000];

function classifyHttpStatus(status: number): EvolutionErrorCode {
  if (status === 401 || status === 403) return 'EVO_AUTH';
  if (status === 404) return 'EVO_NOT_FOUND';
  if (status === 400 || status === 422) return 'EVO_VALIDATION';
  if (status === 429) return 'EVO_RATE_LIMIT';
  if (status >= 500) return 'EVO_SERVER';
  return 'EVO_UNKNOWN';
}

/** Ofusca o `number` (só dígitos) para logging. Mantém DDI/DDD e os 2 últimos dígitos. */
function maskRecipient(num: string | undefined): string {
  if (!num) return '';
  if (num.length <= 4) return `***${num.slice(-2)}`;
  return `${num.slice(0, 2)}***${num.slice(-2)}`;
}

function logLine(
  logger: Logger | undefined,
  level: 'info' | 'warn' | 'error',
  msg: string,
  ctx: Record<string, unknown>,
): void {
  if (logger) {
    logger[level](msg, ctx);
    return;
  }
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    lvl: level.toUpperCase(),
    fn: 'evolution-client',
    msg,
    ctx,
  });
  if (level === 'info') Deno.stdout.write(new TextEncoder().encode(entry + '\n')).catch(() => {});
  else Deno.stderr.write(new TextEncoder().encode(entry + '\n')).catch(() => {});
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: string;
  body?: Record<string, unknown>;
  /** Quando true, aplica retry exponencial em 5xx/timeout. */
  retryable: boolean;
  meta?: Record<string, unknown>;
}

async function doFetch(
  cfg: Required<Pick<EvolutionClientConfig, 'baseUrl' | 'apiKey'>> & { timeoutMs: number },
  opts: RequestOptions,
): Promise<{ status: number; bodyText: string; ok: boolean; aborted: boolean; networkError?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}${opts.path}`, {
      method: opts.method,
      headers: {
        // Evolution v2.3.7: header `apikey` (não `X-Api-Key`).
        'apikey': cfg.apiKey,
        'Accept': 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
    const bodyText = await res.text();
    return { status: res.status, bodyText, ok: res.ok, aborted: false };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    return {
      status: 0,
      bodyText: '',
      ok: false,
      aborted,
      networkError: aborted ? 'timeout' : ((err as Error)?.message ?? 'fetch failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(
  cfg: Required<Pick<EvolutionClientConfig, 'baseUrl' | 'apiKey'>> & {
    timeoutMs: number;
    maxReadRetries: number;
    logger?: Logger;
  },
  opts: RequestOptions,
): Promise<EvolutionResult<T>> {
  const maxAttempts = opts.retryable ? Math.max(1, cfg.maxReadRetries) : 1;
  let attempt = 0;
  let lastFailure: EvolutionFailure | null = null;

  while (attempt < maxAttempts) {
    if (attempt > 0) {
      const delay = READ_BACKOFF_MS[attempt - 1] ?? READ_BACKOFF_MS[READ_BACKOFF_MS.length - 1];
      await new Promise(r => setTimeout(r, delay));
    }
    const start = Date.now();
    const { status, bodyText, ok, aborted, networkError } = await doFetch(cfg, opts);
    const duration_ms = Date.now() - start;

    logLine(cfg.logger, ok ? 'info' : 'warn', 'evolution_request', {
      method: opts.method,
      path: opts.path,
      status,
      ok,
      duration_ms,
      attempt: attempt + 1,
      retryable: opts.retryable,
      ...(opts.meta ?? {}),
      ...(networkError ? { network_error: networkError } : {}),
    });

    if (ok) {
      let parsed: T;
      try {
        parsed = bodyText ? (JSON.parse(bodyText) as T) : (undefined as unknown as T);
      } catch {
        parsed = bodyText as unknown as T;
      }
      return { ok: true, status, data: parsed };
    }

    let errCode: EvolutionErrorCode;
    let message: string | undefined;
    let bodyData: unknown;

    if (aborted) {
      errCode = 'EVO_TIMEOUT';
      message = `timeout after ${cfg.timeoutMs}ms`;
    } else if (status === 0) {
      errCode = 'EVO_NETWORK';
      message = networkError;
    } else {
      errCode = classifyHttpStatus(status);
      try {
        bodyData = bodyText ? JSON.parse(bodyText) : undefined;
      } catch {
        bodyData = bodyText || undefined;
      }
      const msgFromBody =
        (bodyData && typeof bodyData === 'object' && 'message' in (bodyData as Record<string, unknown>))
          ? String((bodyData as Record<string, unknown>).message)
          : bodyText?.slice(0, 200);
      message = msgFromBody || `HTTP ${status}`;
    }

    lastFailure = { ok: false, status, error: errCode, message, data: bodyData };

    const isTransient =
      errCode === 'EVO_SERVER' || errCode === 'EVO_TIMEOUT' || errCode === 'EVO_NETWORK';
    if (!opts.retryable || !isTransient) break;
    attempt++;
  }

  return lastFailure ?? {
    ok: false,
    status: 0,
    error: 'EVO_UNKNOWN',
    message: 'request loop exited without result',
  };
}

/** Monta o body de webhook que o Evolution espera no `create`/`webhook/set`. */
function webhookBody(config: EvolutionWebhookConfig): Record<string, unknown> {
  return {
    enabled: true,
    url: config.url,
    byEvents: config.byEvents ?? false,
    base64: config.base64 ?? true,
    events: config.events,
    ...(config.headers ? { headers: config.headers } : {}),
  };
}

// ── Factory pública ──────────────────────────────────────────────────────────

export function createEvolutionClient(cfg: EvolutionClientConfig): EvolutionClient {
  if (!cfg.baseUrl) throw new Error('createEvolutionClient: baseUrl é obrigatório');
  if (!cfg.apiKey) throw new Error('createEvolutionClient: apiKey é obrigatório');

  const internal = {
    baseUrl: cfg.baseUrl.replace(/\/+$/, ''),
    apiKey: cfg.apiKey,
    timeoutMs: cfg.timeoutMs ?? envTimeoutMs(),
    maxReadRetries: cfg.maxReadRetries ?? DEFAULT_MAX_READ_RETRIES,
    logger: cfg.logger,
  };

  logLine(internal.logger, 'info', 'evolution_client_boot', {
    base_url: internal.baseUrl,
    api_version: 'v2.3.7',
    timeout_ms: internal.timeoutMs,
  });

  const READ = true;
  const WRITE = false;
  const enc = (s: string) => encodeURIComponent(s);

  return {
    instances: {
      create: (instanceName, opts) => {
        const body: Record<string, unknown> = {
          instanceName,
          integration: opts?.integration ?? 'WHATSAPP-BAILEYS',
          qrcode: true,
        };
        if (opts?.token) body.token = opts.token;
        if (opts?.webhook) body.webhook = webhookBody(opts.webhook);
        return request<EvolutionInstance>(internal, {
          method: 'POST',
          path: '/instance/create',
          body,
          retryable: WRITE,
          meta: {
            instance: instanceName,
            has_webhook: !!opts?.webhook,
            webhook_event_count: opts?.webhook?.events.length ?? 0,
          },
        });
      },

      connect: (instanceName) =>
        request<EvolutionConnectResult>(internal, {
          method: 'GET',
          path: `/instance/connect/${enc(instanceName)}`,
          retryable: READ,
          meta: { instance: instanceName },
        }),

      connectionState: (instanceName) =>
        request<EvolutionConnectionStateResult>(internal, {
          method: 'GET',
          path: `/instance/connectionState/${enc(instanceName)}`,
          retryable: READ,
          meta: { instance: instanceName },
        }),

      logout: (instanceName) =>
        request<unknown>(internal, {
          // Evolution v2.3.7: logout é DELETE (POST /instance/logout → 404).
          method: 'DELETE',
          path: `/instance/logout/${enc(instanceName)}`,
          retryable: WRITE,
          meta: { instance: instanceName },
        }),

      delete: (instanceName) =>
        request<unknown>(internal, {
          method: 'DELETE',
          path: `/instance/delete/${enc(instanceName)}`,
          retryable: WRITE,
          meta: { instance: instanceName },
        }),

      restart: (instanceName) =>
        request<unknown>(internal, {
          method: 'POST',
          path: `/instance/restart/${enc(instanceName)}`,
          retryable: WRITE,
          meta: { instance: instanceName },
        }),
    },

    webhook: {
      set: (instanceName, config) =>
        request<unknown>(internal, {
          method: 'POST',
          path: `/webhook/set/${enc(instanceName)}`,
          body: webhookBody(config),
          retryable: WRITE,
          meta: { instance: instanceName, webhook_event_count: config.events.length },
        }),

      find: (instanceName) =>
        request<unknown>(internal, {
          method: 'GET',
          path: `/webhook/find/${enc(instanceName)}`,
          retryable: READ,
          meta: { instance: instanceName },
        }),
    },

    messages: {
      sendText: (input) =>
        request<EvolutionSendResult>(internal, {
          method: 'POST',
          path: `/message/sendText/${enc(input.instance)}`,
          body: {
            number: input.to,
            text: input.text,
            ...(input.delay !== undefined ? { delay: input.delay } : {}),
            ...(input.linkPreview !== undefined ? { linkPreview: input.linkPreview } : {}),
            ...(input.quoted ? { quoted: { key: { id: input.quoted } } } : {}),
          },
          retryable: WRITE,
          meta: { instance: input.instance, recipient: maskRecipient(input.to), text_length: input.text?.length ?? 0 },
        }),

      sendMedia: (input) =>
        request<EvolutionSendResult>(internal, {
          method: 'POST',
          path: `/message/sendMedia/${enc(input.instance)}`,
          body: {
            number: input.to,
            mediatype: input.mediatype,
            media: input.media,
            ...(input.caption ? { caption: input.caption } : {}),
            ...(input.fileName ? { fileName: input.fileName } : {}),
            ...(input.delay !== undefined ? { delay: input.delay } : {}),
          },
          retryable: WRITE,
          meta: {
            instance: input.instance,
            recipient: maskRecipient(input.to),
            mediatype: input.mediatype,
            has_caption: !!input.caption,
          },
        }),

      sendAudio: (input) =>
        request<EvolutionSendResult>(internal, {
          method: 'POST',
          path: `/message/sendWhatsAppAudio/${enc(input.instance)}`,
          body: {
            number: input.to,
            audio: input.audio,
            ...(input.delay !== undefined ? { delay: input.delay } : {}),
          },
          retryable: WRITE,
          meta: { instance: input.instance, recipient: maskRecipient(input.to) },
        }),
    },
  };
}
