// supabase/functions/email-unsubscribe/handler.ts
import { readUnsubToken, maskEmail, unsubLinks } from '../_shared/email-unsub-token.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

export async function handleUnsubscribe(req: Request, deps: {
  secret: string;
  unsubscribe: (email: string, reason: string) => Promise<string>;
  status: (email: string) => Promise<string>;
}): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const qToken = url.searchParams.get('t') ?? '';
  if (req.method === 'GET') {
    return new Response(null, { status: 302, headers: { location: unsubLinks(qToken).page } });
  }
  if (req.method !== 'POST') return json({ ok: false }, 405);

  const ctype = req.headers.get('content-type') ?? '';
  let token = qToken; let action = 'unsubscribe'; let reason = 'link';
  if (ctype.includes('application/json')) {
    const b = await req.json().catch(() => ({})) as { token?: string; action?: string };
    token = b.token ?? token; action = b.action === 'peek' ? 'peek' : 'unsubscribe';
  } else {
    // RFC 8058: POST com corpo "List-Unsubscribe=One-Click" (Gmail/Yahoo), sem JS nem cookies
    const body = await req.text().catch(() => '');
    if (body.includes('List-Unsubscribe=One-Click')) reason = 'one_click';
  }
  const email = await readUnsubToken(token, deps.secret);
  if (!email) return json({ ok: false }, 400);
  try {
    if (action === 'peek') return json({ ok: true, email: maskEmail(email), status: await deps.status(email) });
    const status = await deps.unsubscribe(email, reason);
    return json({ ok: true, email: maskEmail(email), status });
  } catch (_) {
    // nunca dizer "pronto" sem ter gravado: 500 faz o Gmail tentar de novo e a página mostrar erro
    return json({ ok: false }, 500);
  }
}
