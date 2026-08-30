// Action token minting — ADR-SP-02.
// Called by issue-action-token edge function AFTER authorization is verified.
// This helper only mints — it does NOT check authorization (that's the caller's job).

import { b64url, hmacSign } from './hmac.ts';
import { getActionSignKey } from './vault.ts';
import type { IssueActionTokenInput } from './types.ts';

export type { IssueActionTokenInput, ActionName } from './types.ts';

export async function issueActionToken(input: IssueActionTokenInput): Promise<string> {
  const { action, resource_id, tenant_id, issuer, ttl_seconds = 60 } = input;

  if (ttl_seconds < 10 || ttl_seconds > 120) throw new Error('ttl_exceeds_policy');

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl_seconds;
  const jti = crypto.randomUUID();

  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'SP-ACT', kid: 'v1' }));
  const payload = b64url(JSON.stringify({ act: action, res: resource_id, tid: tenant_id, iss: issuer, iat: now, exp, jti }));

  const key = await getActionSignKey();
  const sig = await hmacSign(key, `${header}.${payload}`);

  return `${header}.${payload}.${sig}`;
}
