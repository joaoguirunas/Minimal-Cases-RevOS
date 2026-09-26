// supabase/functions/_shared/email-unsub-token.ts
/** Token de descadastro: base64url(email).base64url(HMAC-SHA256(email))[0..22]. Sem banco. */
import { encodeBase64Url, decodeBase64Url } from 'https://deno.land/std@0.224.0/encoding/base64url.ts';

const LINK_BASE = 'https://link.minimalcases.com.br';
const enc = new TextEncoder();
const norm = (e: string) => e.trim().toLowerCase();

async function mac(email: string, secret: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(email));
  return encodeBase64Url(new Uint8Array(sig)).slice(0, 22);
}

export async function makeUnsubToken(email: string, secret: string): Promise<string> {
  const e = norm(email);
  return `${encodeBase64Url(enc.encode(e))}.${await mac(e, secret)}`;
}

export async function readUnsubToken(token: string, secret: string): Promise<string | null> {
  const [a, b] = (token ?? '').split('.');
  if (!a || !b) return null;
  let email: string;
  try { email = norm(new TextDecoder().decode(decodeBase64Url(a))); } catch { return null; }
  if (!email.includes('@')) return null;
  const expected = await mac(email, secret);
  if (expected.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < b.length; i++) diff |= expected.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0 ? email : null;
}

export function unsubLinks(token: string) {
  return { page: `${LINK_BASE}/sair/${token}`, oneClick: `${LINK_BASE}/u/${token}` };
}

export function maskEmail(email: string): string {
  const [user, domain] = norm(email).split('@');
  return `${user.slice(0, Math.min(2, user.length))}***@${domain ?? ''}`;
}
