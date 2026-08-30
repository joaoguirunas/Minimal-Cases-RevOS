// Booking token validation — ADR-SP-01.
// Validation order is strict and MUST NOT be changed — see ADR for invariants.
// This function is read-only: it never writes to any table.

import { b64urlDecode, hmacVerify } from './hmac.ts';
import { getCapabilityVerifyKey } from './vault.ts';
import type { BookingCapability, ValidationResult } from './types.ts';

export type { ValidationFailureReason, ValidationResult } from './types.ts';

export async function validateBookingCapability(
  token: string,
  required_capability: BookingCapability,
  // supabase client is optional — denylist check is skipped if not provided (e.g. in tests)
  // Pass the service-role client from the calling edge function.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any
): Promise<ValidationResult> {
  // Step 1 — Format
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'invalid_format' };
  const [h, p, s] = parts;

  // Step 2 — Header: alg + typ
  let header: Record<string, string>;
  try {
    header = JSON.parse(b64urlDecode(h));
  } catch {
    return { valid: false, reason: 'invalid_format' };
  }
  if (header.alg !== 'HS256' || header.typ !== 'SP-CAP') {
    return { valid: false, reason: 'invalid_format' };
  }

  // Step 3 — Kid → key
  let key: CryptoKey;
  try {
    key = await getCapabilityVerifyKey(header.kid ?? '');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    return { valid: false, reason: msg.startsWith('unknown_kid') ? 'unknown_kid' : 'missing_secret' };
  }

  // Step 4 — Signature
  const sigOk = await hmacVerify(key, `${h}.${p}`, s);
  if (!sigOk) return { valid: false, reason: 'invalid_signature' };

  // Step 5 — Expiration
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(b64urlDecode(p));
  } catch {
    return { valid: false, reason: 'invalid_format' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    return { valid: false, reason: 'expired' };
  }

  // Step 6 — Scope (exact match per ADR-SP-01)
  if (payload.cap !== required_capability) {
    return { valid: false, reason: 'insufficient_scope' };
  }

  // Step 7 — Denylist (skip if no supabase client provided)
  const jti = payload.jti as string;
  if (supabase) {
    const { data: denied } = await supabase
      .from('booking_token_denylist')
      .select('jti')
      .eq('jti', jti)
      .maybeSingle();
    if (denied) return { valid: false, reason: 'revoked' };
  }

  // Step 8 — Success
  return {
    valid: true,
    lead_id:    payload.sub as string,
    tenant_id:  payload.tid as string,
    capability: payload.cap as BookingCapability,
    jti,
    exp: payload.exp,
  };
}
