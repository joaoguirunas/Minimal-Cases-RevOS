// Booking token minting — ADR-SP-01.
// Called server-side only when generating a shareable booking link.
// Never call from frontend — tenant_id must come from server-side context.

import { b64url, hmacSign } from './hmac.ts';
import { getCapabilitySignKey } from './vault.ts';
import type { MintBookingTokenInput } from './types.ts';

export type { MintBookingTokenInput } from './types.ts';
export type { BookingCapability } from './types.ts';

export async function mintBookingToken(input: MintBookingTokenInput): Promise<string> {
  const { lead_id, tenant_id, capability, ttl_days = 30 } = input;

  if (ttl_days < 1 || ttl_days > 90) throw new Error('ttl_exceeds_policy');

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl_days * 86_400;
  const jti = crypto.randomUUID();

  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'SP-CAP', kid: 'v1' }));
  const payload = b64url(JSON.stringify({ sub: lead_id, tid: tenant_id, cap: capability, iat: now, exp, jti }));

  const key = await getCapabilitySignKey();
  const sig = await hmacSign(key, `${header}.${payload}`);

  return `${header}.${payload}.${sig}`;
}
