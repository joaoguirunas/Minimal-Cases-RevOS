// Action token validation + atomic single-use consume — ADR-SP-02.
// Validation order is strict and MUST NOT be changed — see ADR for invariants.
//
// Step 7 uses INSERT ON CONFLICT DO NOTHING RETURNING jti.
// If RETURNING is empty, conflict occurred → already_consumed.
// This is the atomic check+mark — there is no separate "check then write".
//
// If action execution fails after consume, the token stays consumed.
// Caller must request a new token from issue-action-token.

import { b64urlDecode, hmacVerify } from './hmac.ts';
import { getActionVerifyKey } from './vault.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ActionName, ActionTokenResult } from './types.ts';

export type { ActionTokenFailureReason, ActionTokenResult } from './types.ts';

export async function consumeActionToken(
  supabase: ReturnType<typeof createClient>,
  token: string,
  expected_action: ActionName
): Promise<ActionTokenResult> {
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
  if (header.alg !== 'HS256' || header.typ !== 'SP-ACT') {
    return { valid: false, reason: 'invalid_format' };
  }

  // Step 3 — Kid → key
  let key: CryptoKey;
  try {
    key = await getActionVerifyKey(header.kid ?? '');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    return { valid: false, reason: msg.startsWith('unknown_kid') ? 'unknown_kid' : 'missing_secret' };
  }

  // Step 4 — Signature (before any DB write — invalid tokens never touch action_token_consumed)
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

  // Step 6 — Action match (exact)
  if (payload.act !== expected_action) {
    return { valid: false, reason: 'wrong_action' };
  }

  // Step 7 — Atomic single-use: INSERT ON CONFLICT DO NOTHING RETURNING jti
  // Empty RETURNING → conflict → already_consumed. No race condition possible.
  const jti      = payload.jti as string;
  const tokenExp = new Date((payload.exp as number) * 1000).toISOString();

  const { data: inserted } = await supabase
    .from('action_token_consumed')
    .insert({
      jti,
      action:      payload.act,
      resource_id: payload.res,
      tenant_id:   payload.tid,
      token_exp:   tokenExp,
    })
    .select('jti')
    .single();

  if (!inserted) return { valid: false, reason: 'already_consumed' };

  // Step 8 — Success
  return {
    valid:       true,
    action:      payload.act      as ActionName,
    resource_id: payload.res      as string,
    tenant_id:   payload.tid      as string,
    jti,
    exp:         payload.exp      as number,
  };
}
