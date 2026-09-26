// supabase/functions/resend-webhook/handler.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { handleResendWebhook } from './handler.ts';

const raw = new TextEncoder().encode('chave-de-teste-32-bytes-xxxxxxxx');
const secret = 'whsec_' + encodeBase64(raw);
const now = 1_790_000_000;
async function signed(body: string, id = 'msg_1') {
  const k = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${now}.${body}`));
  return new Request('https://x/resend-webhook', { method: 'POST', body, headers: {
    'svix-id': id, 'svix-timestamp': String(now), 'svix-signature': 'v1,' + encodeBase64(new Uint8Array(s)) } });
}
const body = JSON.stringify({ type: 'email.delivered', created_at: '2026-09-26T12:00:00Z', data: { email_id: 'em_1', to: ['a@b.com'] } });

Deno.test('evento assinado é aplicado com id, tipo e email_id', async () => {
  const seen: unknown[] = [];
  const res = await handleResendWebhook(await signed(body), { secret, nowSec: now, apply: async (...a) => { seen.push(a); return { duplicate: false }; } });
  assertEquals(res.status, 200);
  assertEquals((seen[0] as unknown[]).slice(0, 3), ['msg_1', 'email.delivered', 'em_1']);
});
Deno.test('assinatura inválida → 401 e nada aplicado', async () => {
  const req = await signed(body); const bad = new Request(req.url, { method: 'POST', body: body + ' ', headers: req.headers });
  let n = 0;
  const res = await handleResendWebhook(bad, { secret, nowSec: now, apply: async () => { n++; return { duplicate: false }; } });
  assertEquals(res.status, 401); assertEquals(n, 0);
});
Deno.test('duplicado responde 200 (Resend não reenvia)', async () => {
  const res = await handleResendWebhook(await signed(body), { secret, nowSec: now, apply: async () => ({ duplicate: true }) });
  assertEquals(res.status, 200);
});
