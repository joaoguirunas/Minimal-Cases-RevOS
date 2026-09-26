// supabase/functions/resend-webhook/handler.ts
import { verifySvix } from '../_shared/svix-verify.ts';

export async function handleResendWebhook(req: Request, deps: {
  secret: string;
  apply: (id: string, type: string, msgId: string | null, payload: unknown, at: string) => Promise<{ duplicate: boolean }>;
  nowSec?: number;
}): Promise<Response> {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const body = await req.text();
  const ok = await verifySvix({ id: req.headers.get('svix-id'), timestamp: req.headers.get('svix-timestamp'), signature: req.headers.get('svix-signature') },
    body, deps.secret, deps.nowSec);
  if (!ok) return new Response('invalid signature', { status: 401 });
  let evt: { type?: string; created_at?: string; data?: { email_id?: string } };
  try { evt = JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }
  if (!evt.type) return new Response('no type', { status: 400 });
  const r = await deps.apply(req.headers.get('svix-id')!, evt.type, evt.data?.email_id ?? null, evt, evt.created_at ?? new Date().toISOString());
  return new Response(JSON.stringify({ ok: true, duplicate: r.duplicate }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
