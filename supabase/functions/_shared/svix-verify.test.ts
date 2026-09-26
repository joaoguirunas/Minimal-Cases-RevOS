// supabase/functions/_shared/svix-verify.test.ts
import { assert, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { verifySvix } from './svix-verify.ts';

const rawKey = new TextEncoder().encode('chave-de-teste-32-bytes-xxxxxxxx');
const SECRET = 'whsec_' + encodeBase64(rawKey);
async function sign(id: string, ts: string, body: string) {
  const k = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return 'v1,' + encodeBase64(new Uint8Array(sig));
}
const body = '{"type":"email.delivered"}';
const now = 1_790_000_000;

Deno.test('assinatura válida passa (inclusive com várias assinaturas no header)', async () => {
  const s = await sign('msg_1', String(now), body);
  assert(await verifySvix({ id: 'msg_1', timestamp: String(now), signature: `v1,AAAA ${s}` }, body, SECRET, now));
});
Deno.test('corpo adulterado, id trocado, sem header ou expirado → falha', async () => {
  const s = await sign('msg_1', String(now), body);
  assertFalse(await verifySvix({ id: 'msg_1', timestamp: String(now), signature: s }, body + ' ', SECRET, now));
  assertFalse(await verifySvix({ id: 'msg_2', timestamp: String(now), signature: s }, body, SECRET, now));
  assertFalse(await verifySvix({ id: null, timestamp: String(now), signature: s }, body, SECRET, now));
  assertFalse(await verifySvix({ id: 'msg_1', timestamp: String(now), signature: s }, body, SECRET, now + 301));
});
