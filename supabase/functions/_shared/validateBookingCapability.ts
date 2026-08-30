/**
 * Booking Capability Token — Schedule PRO™ (ADR-SP-01)
 *
 * HMAC-HS256 signed tokens for gcal_sync and wa_confirm edge actions.
 * Secret: BOOKING_CAPABILITY_SECRET (Supabase Vault → Deno env).
 *
 * Fail-closed: throws if secret is absent (not configured = deny by default).
 */

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function getSecret(): string {
  const s = Deno.env.get('BOOKING_CAPABILITY_SECRET');
  if (!s) throw new Error('BOOKING_CAPABILITY_SECRET not configured — see ADR-SP-01 for Vault bootstrap');
  return s;
}

const HEADER = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));

export async function issueBookingCapability({
  meeting_id,
  action,
  ttl_seconds,
}: {
  meeting_id: string;
  action: string;
  ttl_seconds: number;
}): Promise<string> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({ mid: meeting_id, act: action, iat: now, exp: now + ttl_seconds }),
    ),
  );
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${HEADER}.${payload}`));
  return `${HEADER}.${payload}.${base64url(new Uint8Array(sig))}`;
}

export async function validateBookingCapability(
  token: string,
  expected_action: string,
): Promise<{ valid: boolean; meeting_id?: string; reason?: string }> {
  const secret = getSecret();
  const parts = token?.split('.');
  if (!parts || parts.length !== 3) return { valid: false, reason: 'malformed_token' };

  const [header, payloadB64, sigB64] = parts;
  const key = await hmacKey(secret);

  const expectedSigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${payloadB64}`),
  );
  const expectedSig = new Uint8Array(expectedSigBuf);

  let actualSig: Uint8Array;
  try {
    actualSig = base64urlDecode(sigB64);
  } catch {
    return { valid: false, reason: 'invalid_signature' };
  }

  if (actualSig.length !== expectedSig.length) return { valid: false, reason: 'invalid_signature' };
  let diff = 0;
  for (let i = 0; i < actualSig.length; i++) diff |= actualSig[i] ^ expectedSig[i];
  if (diff !== 0) return { valid: false, reason: 'invalid_signature' };

  let claims: { mid?: string; act?: string; exp?: number };
  try {
    claims = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
  } catch {
    return { valid: false, reason: 'malformed_payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp < now) return { valid: false, reason: 'token_expired' };
  if (claims.act !== expected_action) return { valid: false, reason: 'action_mismatch' };
  if (!claims.mid) return { valid: false, reason: 'missing_meeting_id' };

  return { valid: true, meeting_id: claims.mid };
}
