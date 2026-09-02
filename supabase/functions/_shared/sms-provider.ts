/**
 * _shared/sms-provider.ts — sender de SMS unificado (KLV-1, espelho do email-provider).
 *
 * Fonte única de "enviar SMS via provider configurado" para o canal omni `sms`.
 * Consumido por: followup-trigger-worker (fups de SMS por etapa) e channel-test-send.
 *
 * Providers (omni_channel_configs.credentials, channel='sms'):
 *   twilio  → envio direto (Messages.json)
 *   klaviyo → upsert do profile + Create Event (métrica custom); um Flow no Klaviyo
 *             disparado pela métrica envia o SMS usando {{ event.message }}.
 *             Exige que o profile tenha consentimento de SMS no Klaviyo — sem consent
 *             o flow pula o envio (comportamento do Klaviyo, não erro nosso).
 *
 * Nunca lança: sempre retorna { success, error? }.
 */

import { KlaviyoClient, toE164BR, isKlaviyoSendLocked, KLAVIYO_LOCKED_MSG } from './klaviyo-client.ts';
import { renderTemplate } from './email-provider.ts';

const DIRECT_SMS_PROVIDERS = ['twilio', 'klaviyo'] as const;
const SEND_TIMEOUT_MS = 30_000;

export interface SmsCredentials {
  provider?: string;
  // twilio
  account_sid?: string;
  auth_token?: string;
  from_number?: string;
  // klaviyo
  api_key?: string;
  metric_sms?: string;
  [key: string]: string | undefined;
}

export interface SmsConfig {
  is_active?: boolean;
  credentials?: SmsCredentials | null;
}

export interface SendSmsParams {
  to: string;
  message: string;
  /** Tokens {{chave}} substituídos na mensagem (texto puro). */
  vars?: Record<string, string>;
}

export interface SmsSendResult {
  success: boolean;
  error?: string;
}

export function hasDirectSmsProvider(creds?: SmsCredentials | null): boolean {
  const provider = creds?.provider;
  return !!provider && (DIRECT_SMS_PROVIDERS as readonly string[]).includes(provider);
}

async function dispatchTwilio(creds: SmsCredentials, to: string, message: string): Promise<SmsSendResult> {
  if (!creds.account_sid || !creds.auth_token || !creds.from_number) {
    return { success: false, error: 'Twilio: Account SID, Auth Token e número são obrigatórios' };
  }
  const e164 = toE164BR(to) ?? to;
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Messages.json`;
    const params = new URLSearchParams({ To: e164, From: creds.from_number, Body: message });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${creds.account_sid}:${creds.auth_token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { success: false, error: `Twilio ${res.status}: ${txt.substring(0, 200)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: `Twilio: ${(e as Error).message}` };
  }
}

async function dispatchKlaviyoSms(
  creds: SmsCredentials,
  to: string,
  message: string,
  vars: Record<string, string>,
): Promise<SmsSendResult> {
  if (!creds.api_key) return { success: false, error: 'Klaviyo: api_key (chave privada) é obrigatória' };
  if (isKlaviyoSendLocked(creds)) return { success: false, error: KLAVIYO_LOCKED_MSG };
  const phone = toE164BR(to);
  if (!phone) return { success: false, error: `Klaviyo: telefone inválido para E.164: "${to}"` };
  const metric = creds.metric_sms?.trim() || 'CRM SMS Followup';
  const client = new KlaviyoClient(creds.api_key);
  try {
    await client.upsertProfile({ phone_number: phone });
    await client.createEvent({
      metricName: metric,
      profile: { phone_number: phone },
      properties: { message, canal: 'sms', origem: 'revos-crm', ...vars },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: `Klaviyo: ${(e as Error).message}` };
  }
}

/** Renderiza a mensagem com `vars` e despacha pelo provider configurado. */
export async function sendSmsWithConfig(config: SmsConfig, params: SendSmsParams): Promise<SmsSendResult> {
  const creds = (config.credentials ?? {}) as SmsCredentials;
  if (!hasDirectSmsProvider(creds)) {
    return { success: false, error: `Canal SMS sem provider de envio direto (provider='${creds.provider ?? 'nenhum'}')` };
  }
  if (!params.to) return { success: false, error: 'Destinatário (to) vazio' };

  const message = renderTemplate(params.message ?? '', params.vars ?? {}, { escape: false });
  switch (creds.provider) {
    case 'twilio': return dispatchTwilio(creds, params.to, message);
    case 'klaviyo': return dispatchKlaviyoSms(creds, params.to, message, params.vars ?? {});
    default: return { success: false, error: `Provider SMS não suportado: ${creds.provider}` };
  }
}
