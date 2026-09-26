// supabase/functions/_shared/email-sender.ts
/**
 * Remetente único do Correio (Parte 1). Todo e-mail da esteira passa aqui:
 * supressão → link/cabeçalhos de descadastro → Resend ou Klaviyo (aquecimento) → registro.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderTemplate, sendEmailWithConfig, type EmailConfig } from './email-provider.ts';
import { chooseProvider } from './email-split.ts';
import { makeUnsubToken, unsubLinks } from './email-unsub-token.ts';

type Provider = 'resend' | 'klaviyo';
type Kind = 'esteira' | 'campaign' | 'flow' | 'test' | 'other';

export function planSend(i: { contactStatus: string; email: string; sharePct: number; forceProvider?: Provider }): { action: 'suppress' | Provider } {
  if (i.contactStatus !== 'subscribed') return { action: 'suppress' };
  if (i.forceProvider) return { action: i.forceProvider };
  return { action: chooseProvider(i.email, i.sharePct) };
}

export function listUnsubscribeHeaders(oneClickUrl: string, fromEmail: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUrl}>, <mailto:${fromEmail}?subject=Descadastro>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export async function resendSend(
  apiKey: string,
  p: { from: string; to: string; subject: string; html: string; headers: Record<string, string>; tags: { name: string; value: string }[]; idempotencyKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; id: string } | { ok: false; error: string; retryAfter?: number }> {
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': p.idempotencyKey },
      body: JSON.stringify({ from: p.from, to: p.to, subject: p.subject, html: p.html, headers: p.headers, tags: p.tags }),
      signal: AbortSignal.timeout(30_000),
    });
    const txt = await res.text();
    if (!res.ok) {
      const ra = Number(res.headers.get('retry-after'));
      return { ok: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}`, ...(Number.isFinite(ra) && ra > 0 ? { retryAfter: ra } : {}) };
    }
    const id = (JSON.parse(txt) as { id?: string }).id;
    return id ? { ok: true, id } : { ok: false, error: 'Resend sem id na resposta' };
  } catch (e) {
    return { ok: false, error: `Resend: ${(e as Error).message}` };
  }
}

// Tags do Resend aceitam só [A-Za-z0-9_-].
const tagValue = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);

export async function sendTrackedEmail(
  supabase: SupabaseClient,
  p: { config: EmailConfig; to: string; subject: string; html: string; vars: Record<string, string>; kind: Kind;
       peopleId?: string | null; followupQueueId?: string | null; templateName?: string | null; forceProvider?: Provider },
): Promise<{ success: boolean; status: 'sent' | 'suppressed' | 'failed'; messageId?: string; provider?: Provider; error?: string }> {
  const email = (p.to ?? '').trim().toLowerCase();
  const creds = (p.config.credentials ?? {}) as Record<string, string>;
  const base = { to_email: email, people_id: p.peopleId ?? null, kind: p.kind, followup_queue_id: p.followupQueueId ?? null, template_name: p.templateName ?? null };
  if (!email.includes('@')) {
    await supabase.from('email_messages').insert({ ...base, status: 'failed', error: 'e-mail inválido' });
    return { success: false, status: 'failed', error: 'e-mail inválido' };
  }

  const { data: st } = await supabase.rpc('email_contact_status', { p_email: email });
  const plan = planSend({ contactStatus: String(st ?? 'subscribed'), email, sharePct: Number(creds.resend_share_pct ?? 0) || 0, forceProvider: p.forceProvider });
  if (plan.action === 'suppress') {
    await supabase.from('email_messages').insert({ ...base, status: 'suppressed', error: `contato ${st}` });
    return { success: false, status: 'suppressed', error: `contato ${st}` };
  }

  const secret = Deno.env.get('EMAIL_UNSUBSCRIBE_SECRET') ?? '';
  if (!secret) return { success: false, status: 'failed', error: 'EMAIL_UNSUBSCRIBE_SECRET não configurado' };
  const links = unsubLinks(await makeUnsubToken(email, secret));
  const vars = { ...p.vars, unsubscribe: links.page };

  const { data: row } = await supabase.from('email_messages')
    .insert({ ...base, provider: plan.action, status: 'failed', error: 'enviando' }).select('id').single();
  const msgId = (row as { id: string }).id;

  if (plan.action === 'klaviyo') {
    const r = await sendEmailWithConfig({ ...p.config, credentials: { ...creds, provider: 'klaviyo' } }, { to: email, subject: p.subject, html: p.html, vars });
    await supabase.from('email_messages').update(r.success
      ? { status: 'sent', error: null, sent_at: new Date().toISOString(), subject: renderTemplate(p.subject, vars, { escape: false }) }
      : { status: 'failed', error: r.error ?? 'falha Klaviyo' }).eq('id', msgId);
    return r.success ? { success: true, status: 'sent', messageId: msgId, provider: 'klaviyo' } : { success: false, status: 'failed', provider: 'klaviyo', error: r.error };
  }

  const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const subject = renderTemplate(p.subject, vars, { escape: false });
  const html = renderTemplate(p.html, vars, { escape: true });
  const fromEmail = creds.from_email || 'contato@minimalcases.com.br';
  const r = apiKey
    ? await resendSend(apiKey, {
        from: creds.from_name ? `${creds.from_name} <${fromEmail}>` : fromEmail, to: email, subject, html,
        headers: listUnsubscribeHeaders(links.oneClick, fromEmail),
        tags: [{ name: 'kind', value: p.kind }, ...(p.followupQueueId ? [{ name: 'followup_queue_id', value: tagValue(p.followupQueueId) }] : [])],
        idempotencyKey: msgId,
      })
    : { ok: false as const, error: 'RESEND_API_KEY não configurada' };
  await supabase.from('email_messages').update(r.ok
    ? { status: 'sent', error: null, provider_message_id: r.id, subject, sent_at: new Date().toISOString() }
    : { status: 'failed', error: r.error, subject }).eq('id', msgId);
  return r.ok ? { success: true, status: 'sent', messageId: msgId, provider: 'resend' } : { success: false, status: 'failed', provider: 'resend', error: r.error };
}
