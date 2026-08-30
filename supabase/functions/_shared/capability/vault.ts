// Vault key resolution with per-isolate cache.
//
// Production: keys come from Supabase Vault via the secret name.
// Development/test fallback: reads from Deno.env directly.
//
// TODO(production): replace Deno.env fallback with actual Vault API call:
//   POST /vault/secrets/{name} with service-role bearer token.
//   When Vault is bootstrapped, remove the env fallback entirely.
//
// kid → env var mapping (one entry per active key version):
//   'v1' → CAPABILITY_SECRET_KEY   (booking tokens)
//   'v1' → ACTION_SECRET_KEY       (action tokens — separate secret)
//
// To support rotation: add 'v2' → NEW_KEY entries here. Both v1 and v2 resolve
// during the transition window; remove v1 after all v1-signed tokens expire.

import { importHmacKey } from './hmac.ts';

type KeyUsage = 'sign' | 'verify';

// Per-isolate caches — one CryptoKey per (envVar, usage) pair.
const _cache = new Map<string, CryptoKey>();

async function resolveKey(envVar: string, usage: KeyUsage): Promise<CryptoKey> {
  const cacheKey = `${envVar}:${usage}`;
  const cached = _cache.get(cacheKey);
  if (cached) return cached;

  const secret = Deno.env.get(envVar) ?? '';
  if (!secret) throw new Error(`missing_secret: ${envVar} not set`);

  const key = await importHmacKey(secret, usage);
  _cache.set(cacheKey, key);
  return key;
}

// Booking token keys (ADR-SP-01) — CAPABILITY_SECRET_KEY
export async function getCapabilitySignKey(): Promise<CryptoKey> {
  return resolveKey('CAPABILITY_SECRET_KEY', 'sign');
}

export async function getCapabilityVerifyKey(kid: string): Promise<CryptoKey> {
  if (kid !== 'v1') throw new Error(`unknown_kid: ${kid}`);
  return resolveKey('CAPABILITY_SECRET_KEY', 'verify');
}

// Action token keys (ADR-SP-02) — ACTION_SECRET_KEY (separate from capability key)
export async function getActionSignKey(): Promise<CryptoKey> {
  return resolveKey('ACTION_SECRET_KEY', 'sign');
}

export async function getActionVerifyKey(kid: string): Promise<CryptoKey> {
  if (kid !== 'v1') throw new Error(`unknown_kid: ${kid}`);
  return resolveKey('ACTION_SECRET_KEY', 'verify');
}
