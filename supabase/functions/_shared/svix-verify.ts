// supabase/functions/_shared/svix-verify.ts
/** Verificação da assinatura Svix (webhooks do Resend). Tolerância de 5 min. */
import { decodeBase64, encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

export async function verifySvix(
  h: { id: string | null; timestamp: string | null; signature: string | null },
  body: string, secret: string, nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!h.id || !h.timestamp || !h.signature || !secret) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false;
  let key: Uint8Array;
  try { key = decodeBase64(secret.startsWith('whsec_') ? secret.slice(6) : secret); } catch { return false; }
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${h.id}.${h.timestamp}.${body}`));
  const expected = encodeBase64(new Uint8Array(sig));
  return h.signature.split(' ').some((part) => {
    const [ver, val] = part.split(',');
    if (ver !== 'v1' || !val || val.length !== expected.length) return false;
    let d = 0;
    for (let i = 0; i < val.length; i++) d |= val.charCodeAt(i) ^ expected.charCodeAt(i);
    return d === 0;
  });
}
