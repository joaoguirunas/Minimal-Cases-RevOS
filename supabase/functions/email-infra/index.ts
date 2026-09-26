// supabase/functions/email-infra/index.ts
/** Painel do envio próprio: domínio no Resend, números, aquecimento, teste e reinscrição. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendTrackedEmail } from '../_shared/email-sender.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const SHARES = [0, 10, 25, 50, 75, 100];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser(auth.replace('Bearer ', ''));
  if (!u?.user) return json({ ok: false, error: 'Unauthorized' }, 401);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: me } = await admin.from('settings_users').select('user_type, super_admin, active, deleted_at').eq('auth_user_id', u.user.id).maybeSingle();
  const m = me as { user_type: string | null; super_admin: boolean | null; active: boolean | null; deleted_at: string | null } | null;
  if (!m?.active || m.deleted_at || !(m.super_admin || m.user_type === 'admin' || m.user_type === 'manager')) return json({ ok: false, error: 'Sem permissão' }, 403);

  const body = await req.json().catch(() => ({})) as { action?: string; pct?: number; to?: string; template_id?: string; email?: string; reason?: string };
  const { data: cfg } = await admin.from('omni_channel_configs').select('is_active, credentials').eq('channel', 'email').maybeSingle();
  const creds = ((cfg as { credentials?: Record<string, unknown> } | null)?.credentials ?? {}) as Record<string, unknown>;
  const key = Deno.env.get('RESEND_API_KEY') ?? '';

  if (body.action === 'status') {
    let domain = null;
    if (key) {
      const list = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()).catch(() => null) as { data?: { id: string; name: string }[] } | null;
      const d = list?.data?.find((x) => x.name === 'minimalcases.com.br');
      if (d) domain = await fetch(`https://api.resend.com/domains/${d.id}`, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()).catch(() => null);
    }
    const [s24, s7] = await Promise.all([admin.rpc('email_stats', { p_hours: 24 }), admin.rpc('email_stats', { p_hours: 168 })]);
    return json({ ok: true, has_key: !!key, domain, share_pct: Number(creds.resend_share_pct ?? 0),
      guard: creds.resend_guard_tripped_at ? { tripped_at: creds.resend_guard_tripped_at, reason: creds.resend_guard_reason } : null,
      stats24: s24.data ?? {}, stats7d: s7.data ?? {} });
  }
  if (body.action === 'set_share') {
    const pct = Number(body.pct);
    if (!SHARES.includes(pct)) return json({ ok: false, error: 'percentual inválido' }, 400);
    if (pct > 0 && !key) return json({ ok: false, error: 'RESEND_API_KEY não configurada' }, 400);
    await admin.from('omni_channel_configs').update({ credentials: { ...creds, resend_share_pct: pct, ...(pct > 0 ? { resend_guard_tripped_at: null, resend_guard_reason: null } : {}) } }).eq('channel', 'email');
    return json({ ok: true, share_pct: pct });
  }
  if (body.action === 'test_send') {
    if (!body.to || !body.template_id) return json({ ok: false, error: 'to e template_id obrigatórios' }, 400);
    const { data: tpl } = await admin.from('email_templates').select('name, subject, html_body').eq('id', body.template_id).maybeSingle();
    const t = tpl as { name: string; subject: string; html_body: string } | null;
    if (!t) return json({ ok: false, error: 'template não encontrado' }, 404);
    const r = await sendTrackedEmail(admin as never, { config: cfg as never, to: body.to, subject: t.subject, html: t.html_body,
      vars: { nome: 'Teste', produto: 'Case Minimal', cupom: 'TESTE15', expira_em: 'amanhã' }, kind: 'test', templateName: t.name, forceProvider: 'resend' });
    return json({ ok: r.success, status: r.status, error: r.error });
  }
  if (body.action === 'resubscribe') {
    if (!body.email || !(body.reason ?? '').trim()) return json({ ok: false, error: 'email e motivo obrigatórios' }, 400);
    await admin.rpc('email_set_contact_status', { p_email: body.email, p_status: 'subscribed', p_reason: `manual: ${body.reason!.trim().slice(0, 200)}` });
    return json({ ok: true });
  }
  return json({ ok: false, error: 'ação desconhecida' }, 400);
});
