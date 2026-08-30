/**
 * _shared/email-provider.ts — sender de e-mail unificado (ADR-EMAIL-01 §Decisão 2).
 *
 * Fonte única de "enviar e-mail via provider configurado" para o canal omni `email`.
 * Consumido por: followup-trigger-worker (ramo e-mail direto), omni-delivery-engine
 * (deliverViaEmail) e channel-test-send (botão de teste).
 *
 * Providers suportados (lidos de omni_channel_configs.credentials, plaintext + RLS):
 *   resend   → POST https://api.resend.com/emails
 *   smtp     → denomailer (SMTP direto)
 *   sendgrid → POST https://api.sendgrid.com/v3/mail/send
 *
 * Nunca lança: sempre retorna { success, error? }.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DIRECT_PROVIDERS = ['resend', 'smtp', 'sendgrid'] as const;
const SEND_TIMEOUT_MS = 30_000;

export interface EmailCredentials {
  provider?: string;
  api_key?: string;
  from_email?: string;
  from_name?: string;
  host?: string;
  port?: string;
  user?: string;
  pass?: string;
  [key: string]: string | undefined;
}

export interface EmailConfig {
  is_active?: boolean;
  credentials?: EmailCredentials | null;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Tokens {{chave}} substituídos em subject/html. Aceita chaves com ponto (ex. pessoa.nome). */
  vars?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

/** HTML-escape de valores de dados (lead) embutidos em markup — mesmo helper de send-invite-email. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Substitui {{chave}} (aceita chaves com ponto, ex. {{pessoa.nome}}) pelos valores de `vars`.
 * Chave ausente → string vazia (paridade com omni-delivery-engine).
 * `escape` (default true): escapa o VALOR substituído — nunca o template. Use escape:false
 * para o subject (texto puro, não é renderizado como HTML).
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
  opts: { escape?: boolean } = {},
): string {
  const escape = opts.escape ?? true;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key] ?? '';
    return escape ? escapeHtml(value) : value;
  });
}

/** true se o canal e-mail tem um provider de envio direto configurado (não webhook-only). */
export function hasDirectEmailProvider(creds?: EmailCredentials | null): boolean {
  const provider = creds?.provider;
  return !!provider && (DIRECT_PROVIDERS as readonly string[]).includes(provider);
}

function resolveFrom(creds: EmailCredentials): string | null {
  if (!creds.from_email) return null;
  return creds.from_name ? `${creds.from_name} <${creds.from_email}>` : creds.from_email;
}

// ── Dispatch por provider (recebe subject/html já renderizados) ─────────────────

async function dispatchResend(creds: EmailCredentials, to: string, subject: string, html: string): Promise<SendResult> {
  if (!creds.api_key || !creds.from_email) {
    return { success: false, error: 'Resend: api_key e from_email são obrigatórios' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: resolveFrom(creds), to, subject, html }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { success: false, error: `Resend ${res.status}: ${txt.substring(0, 200)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: `Resend: ${(e as Error).message}` };
  }
}

async function dispatchSendgrid(creds: EmailCredentials, to: string, subject: string, html: string): Promise<SendResult> {
  if (!creds.api_key || !creds.from_email) {
    return { success: false, error: 'SendGrid: api_key e from_email são obrigatórios' };
  }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: creds.from_email, name: creds.from_name || 'Growthsales' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { success: false, error: `SendGrid ${res.status}: ${txt.substring(0, 200)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: `SendGrid: ${(e as Error).message}` };
  }
}

async function dispatchSmtp(creds: EmailCredentials, to: string, subject: string, html: string): Promise<SendResult> {
  if (!creds.host || !creds.user || !creds.pass || !creds.from_email) {
    return { success: false, error: 'SMTP: host, user, pass e from_email são obrigatórios' };
  }
  // Dynamic import: só a rota SMTP paga o custo de carregar o denomailer (mantém o hot-path
  // do omni-delivery-engine leve para resend/sendgrid).
  const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');
  const port = Number(creds.port) || 587;
  const client = new SMTPClient({
    connection: {
      hostname: creds.host,
      port,
      tls: port === 465,
      auth: { username: creds.user, password: creds.pass },
    },
  });
  try {
    await client.send({
      from: resolveFrom(creds)!,
      to,
      subject,
      content: 'auto',
      html,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: `SMTP: ${(e as Error).message}` };
  } finally {
    try { await client.close(); } catch { /* ignore close errors */ }
  }
}

/**
 * Renderiza subject/html com `vars` e despacha pelo provider de `config.credentials`.
 * NÃO checa `is_active` (o caller decide — o botão de teste envia mesmo com o canal inativo).
 * Subject é renderizado como texto puro (sem escape); html escapa os valores dos tokens.
 */
export async function sendEmailWithConfig(config: EmailConfig, params: SendEmailParams): Promise<SendResult> {
  const creds = (config.credentials ?? {}) as EmailCredentials;
  const provider = creds.provider;

  if (!hasDirectEmailProvider(creds)) {
    return { success: false, error: `Canal e-mail sem provider de envio direto (provider='${provider ?? 'nenhum'}')` };
  }
  if (!params.to) {
    return { success: false, error: 'Destinatário (to) vazio' };
  }

  const vars = params.vars ?? {};
  const subject = renderTemplate(params.subject ?? '', vars, { escape: false });
  const html = renderTemplate(params.html ?? '', vars, { escape: true });

  switch (provider) {
    case 'resend':   return dispatchResend(creds, params.to, subject, html);
    case 'sendgrid': return dispatchSendgrid(creds, params.to, subject, html);
    case 'smtp':     return dispatchSmtp(creds, params.to, subject, html);
    default:         return { success: false, error: `Provider e-mail não suportado: ${provider}` };
  }
}

/**
 * Carrega a config do canal `email` de omni_channel_configs, valida is_active + provider,
 * e envia. Atalho de alto nível para callers que não têm a config em mãos.
 */
export async function sendEmail(
  supabase: SupabaseClient,
  params: SendEmailParams,
): Promise<SendResult> {
  const { data, error } = await supabase
    .from('omni_channel_configs')
    .select('is_active, credentials')
    .eq('channel', 'email')
    .maybeSingle();

  if (error) return { success: false, error: `Falha ao carregar config do canal e-mail: ${error.message}` };
  if (!data) return { success: false, error: 'Canal e-mail não configurado' };

  const config = data as EmailConfig;
  if (!config.is_active) return { success: false, error: 'Canal e-mail inativo' };
  if (!hasDirectEmailProvider(config.credentials)) {
    return { success: false, error: 'Canal e-mail sem provider de envio direto configurado' };
  }
  return sendEmailWithConfig(config, params);
}
