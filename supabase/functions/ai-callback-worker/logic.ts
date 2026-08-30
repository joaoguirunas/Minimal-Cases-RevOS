/**
 * AI-CALLBACK-WORKER — lógica pura (RETORNO-03)
 *
 * Tudo aqui é determinístico e sem I/O, para ser testável com `deno test`
 * (mesmo padrão de kiwify-reconcile/logic.ts).
 *
 * ADR: docs/smart-memory/decisions/ADR-RETORNO-01-agendar-retorno-arquitetura.md (D5, D6).
 */

/** Janela de atendimento da Meta: 24h. Usamos 23h de margem (ADR §D6). */
export const WHATSAPP_WINDOW_HOURS = 23;

/** Máximo de tentativas de disparo antes de desistir (ADR §D5). */
export const MAX_RETRIES = 3;

/** Reagendamento quando a conversa está em andamento (lock/buffer). */
export const BUSY_RETRY_MINUTES = 2;

/** Reagendamento quando o disparo em modo agent falhou. */
export const AGENT_RETRY_MINUTES = 3;

export type CallbackMode = 'direct' | 'agent';

export interface CallbackTemplate {
  id: string;
  label?: string | null;
  body?: string | null;
  whatsapp_template_name?: string | null;
}

export interface CallbackConfigRow {
  id: string;
  agent_id: string;
  step_id: string | null;
  enabled: boolean;
  default_mode: CallbackMode;
  templates: CallbackTemplate[] | null;
  free_prompt: string | null;
  whatsapp_template_fallback: string | null;
}

export interface CallbackRow {
  id: string;
  lead_id: string;
  people_id: string;
  agent_id: string | null;
  step_id: string | null;
  scheduled_for: string;
  mode: CallbackMode;
  template_id: string | null;
  message_text: string | null;
  whatsapp_template_name: string | null;
  reason: string;
  channel: string;
  status: string;
  retry_count: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Valida o bearer decodificando o JWT e conferindo `role === 'service_role'`.
 *
 * NUNCA comparar `bearer === SUPABASE_SERVICE_ROLE_KEY` por string: a rotação para o
 * novo sistema de API keys do Supabase quebra o string-match e o cron passa a tomar
 * 401 silencioso (memória `supabase-new-api-keys-cron-auth`).
 * Espelha kiwify-reconcile/logic.ts:isServiceRoleJwt.
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

// ── Seleção de conteúdo ───────────────────────────────────────────────────────

export interface ResolvedContent {
  /** Texto a enviar dentro da janela (modo direct). */
  text: string | null;
  /** Template aprovado da Meta a usar fora da janela. */
  templateName: string | null;
  /** Instrução extra injetada na reinvocação do agente (modo agent). */
  freePrompt: string | null;
}

/**
 * Resolve o conteúdo efetivo do disparo.
 *
 * Precedência do texto: `message_text` da linha (texto livre ou body do template
 * congelado no agendamento) → body do template referenciado na config.
 * Precedência do template WhatsApp: `whatsapp_template_name` da linha → template da
 * config referenciado por `template_id` → `whatsapp_template_fallback` da config.
 */
export function resolveContent(
  row: Pick<CallbackRow, 'template_id' | 'message_text' | 'whatsapp_template_name'>,
  config: CallbackConfigRow | null,
): ResolvedContent {
  const templates = config?.templates ?? [];
  const tpl = row.template_id ? templates.find(t => String(t.id) === String(row.template_id)) ?? null : null;

  const text = (row.message_text && row.message_text.trim())
    ? row.message_text
    : (tpl?.body && tpl.body.trim() ? tpl.body : null);

  const templateName =
    (row.whatsapp_template_name && row.whatsapp_template_name.trim() ? row.whatsapp_template_name : null) ??
    (tpl?.whatsapp_template_name && tpl.whatsapp_template_name.trim() ? tpl.whatsapp_template_name : null) ??
    (config?.whatsapp_template_fallback && config.whatsapp_template_fallback.trim() ? config.whatsapp_template_fallback : null);

  return { text, templateName, freePrompt: config?.free_prompt ?? null };
}

// ── Decisão de disparo (janela de 24h) ────────────────────────────────────────

export interface DispatchInput {
  channel: string;
  mode: CallbackMode;
  /** ISO da última mensagem inbound do lead; null = nunca houve inbound. */
  lastInboundAt: string | null;
  now: Date;
  text: string | null;
  templateName: string | null;
}

export type DispatchDecision =
  | { kind: 'text'; text: string }
  | { kind: 'template'; templateName: string; degradedFrom?: 'agent' }
  | { kind: 'agent' }
  | { kind: 'fail'; error: string };

/** true quando o canal é whatsapp e a última inbound tem mais de 23h (ou nunca houve). */
export function isOutsideWhatsappWindow(channel: string, lastInboundAt: string | null, now: Date): boolean {
  if (channel !== 'whatsapp') return false; // instagram tem regras próprias — não é gatilhado aqui
  if (!lastInboundAt) return true;
  const last = new Date(lastInboundAt);
  if (isNaN(last.getTime())) return true;
  const ageHours = (now.getTime() - last.getTime()) / 3_600_000;
  return ageHours > WHATSAPP_WINDOW_HOURS;
}

/**
 * Decide COMO o retorno será disparado.
 *
 * Fora da janela de 24h a Meta aceita a chamada e não entrega texto livre
 * (memória `whatsapp-marketing-template-delivery-cap`) → nunca cair para texto:
 * ou existe template aprovado, ou a linha falha explicitamente.
 * Modo `agent` fora da janela degrada para template (LLM não passa no gate da Meta).
 */
export function decideDispatch(input: DispatchInput): DispatchDecision {
  const outside = isOutsideWhatsappWindow(input.channel, input.lastInboundAt, input.now);

  if (!outside) {
    if (input.mode === 'agent') return { kind: 'agent' };
    if (input.text && input.text.trim()) return { kind: 'text', text: input.text };
    return { kind: 'fail', error: 'sem conteúdo para disparo direct (message_text vazio e template sem body)' };
  }

  if (!input.templateName) {
    return {
      kind: 'fail',
      error: `fora da janela de ${WHATSAPP_WINDOW_HOURS}h do WhatsApp e nenhum template aprovado configurado (whatsapp_template_name/whatsapp_template_fallback)`,
    };
  }

  return input.mode === 'agent'
    ? { kind: 'template', templateName: input.templateName, degradedFrom: 'agent' }
    : { kind: 'template', templateName: input.templateName };
}

// ── Reagendamento / retry ─────────────────────────────────────────────────────

export type RetryOutcome =
  | { status: 'pending'; scheduledFor: string; retryCount: number }
  | { status: 'skipped'; retryCount: number }
  | { status: 'failed'; retryCount: number };

/**
 * Calcula o próximo estado de uma linha que não pôde ser disparada agora.
 *
 * `exhausted` decide o estado terminal: conversa em andamento vira `skipped`
 * (não é erro do sistema), falha de disparo vira `failed`.
 */
export function computeRetry(
  retryCount: number,
  now: Date,
  delayMinutes: number,
  exhaustedStatus: 'skipped' | 'failed',
  maxRetries: number = MAX_RETRIES,
): RetryOutcome {
  const next = retryCount + 1;
  if (next >= maxRetries) return { status: exhaustedStatus, retryCount: next };
  return {
    status: 'pending',
    scheduledFor: new Date(now.getTime() + delayMinutes * 60_000).toISOString(),
    retryCount: next,
  };
}

/** Prompt injetado na reinvocação do agente (modo agent). */
export function buildAgentDirectMessage(reason: string, freePrompt: string | null): string {
  const base = `[RETORNO AGENDADO] motivo: ${reason}.`;
  const extra = freePrompt && freePrompt.trim() ? ` ${freePrompt.trim()}` : '';
  return `${base}${extra}`;
}
