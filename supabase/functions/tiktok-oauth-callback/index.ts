/**
 * TikTok OAuth — Callback (POST/JSON) for SPA flow (Story TIKTOK-02)
 *
 * Invoked by the frontend `TiktokCallback.tsx` via supabase.functions.invoke:
 *   supabase.functions.invoke('tiktok-oauth-callback', {
 *     body: { code, state, redirect_uri: `${origin}/tiktok/callback` }
 *   })
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt (called mid-OAuth, before full session)
 *     supabase functions deploy tiktok-oauth-callback --no-verify-jwt
 *
 * Flow:
 *   1. POST { code, redirect_uri, state? }
 *   2. POST https://open.tiktokapis.com/v2/oauth/token/   — exchange code for tokens
 *   3. POST https://open.tiktokapis.com/v2/user/info/     — fetch profile
 *   4. UPSERT omni_channel_configs (channel='tiktok') with credentials JSONB
 *   5. Return { success: true, open_id, display_name }
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto in edge functions)
 *   TIKTOK_APP_ID       — client_key from TikTok Developer App
 *   TIKTOK_APP_SECRET   — client_secret from TikTok Developer App
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── TikTok API helpers (mirrors tiktok-oauth/index.ts) ─────────────────────────

interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;           // typically 86400 (24h)
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;   // typically 31536000 (365 days)
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

async function exchangeCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string,
): Promise<TikTokTokenResponse | null> {
  const body = new URLSearchParams({
    client_key: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const resp = await fetch(`${TIKTOK_API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    console.error('[tiktok-oauth-callback] exchangeCode failed', resp.status, raw);
    return null;
  }

  try {
    const data = JSON.parse(raw) as TikTokTokenResponse;
    if (data.error) {
      console.error('[tiktok-oauth-callback] token error', data.error, data.error_description);
      return null;
    }
    return data;
  } catch {
    console.error('[tiktok-oauth-callback] exchangeCode parse error', raw);
    return null;
  }
}

interface TikTokUserInfo {
  open_id: string;
  display_name: string;
  avatar_url: string;
}

async function fetchUserInfo(accessToken: string): Promise<TikTokUserInfo | null> {
  const resp = await fetch(`${TIKTOK_API}/user/info/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: ['open_id', 'display_name', 'avatar_url'] }),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    console.error('[tiktok-oauth-callback] fetchUserInfo failed', resp.status, raw);
    return null;
  }

  try {
    const data = JSON.parse(raw) as { data?: { user?: TikTokUserInfo } };
    return data?.data?.user ?? null;
  } catch {
    console.error('[tiktok-oauth-callback] fetchUserInfo parse error', raw);
    return null;
  }
}

// ── Main Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const appId          = Deno.env.get('TIKTOK_APP_ID') ?? '';
  const appSecret      = Deno.env.get('TIKTOK_APP_SECRET') ?? '';

  if (!appId || !appSecret) {
    console.error('[tiktok-oauth-callback] missing env', {
      has_app_id: !!appId,
      has_app_secret: !!appSecret,
    });
    return json({ success: false, error: 'app_not_configured' }, 500);
  }

  let payload: { code?: string; redirect_uri?: string; state?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: 'invalid_json_body' }, 400);
  }

  const { code, redirect_uri: redirectUri } = payload;
  if (!code || !redirectUri) {
    return json({ success: false, error: 'missing_code_or_redirect_uri' }, 400);
  }

  try {
    // Step 1 — Exchange authorization code for tokens
    const tokens = await exchangeCode(code, redirectUri, appId, appSecret);
    if (!tokens?.access_token) {
      return json({ success: false, error: 'code_exchange_failed' }, 400);
    }

    const tokenExpiresAt        = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString();

    // Step 2 — Fetch user profile (non-fatal: token response carries open_id)
    const userInfo = await fetchUserInfo(tokens.access_token);
    const openId      = userInfo?.open_id      ?? tokens.open_id;
    const displayName = userInfo?.display_name ?? `TikTok ${tokens.open_id.slice(-6)}`;
    const avatarUrl   = userInfo?.avatar_url    ?? '';

    // Step 3 — Save credentials to omni_channel_configs
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const credentials = {
      open_id:                  openId,
      display_name:             displayName,
      avatar_url:               avatarUrl,
      access_token:             tokens.access_token,
      refresh_token:            tokens.refresh_token,
      token_expires_at:         tokenExpiresAt,
      refresh_token_expires_at: refreshTokenExpiresAt,
      app_id:                   appId,
    };

    const { error: upsertErr } = await supabase
      .from('omni_channel_configs')
      .upsert(
        { channel: 'tiktok', is_active: true, credentials },
        { onConflict: 'channel' },
      );

    if (upsertErr) {
      console.error('[tiktok-oauth-callback] upsert failed', upsertErr.message);
      return json({ success: false, error: 'failed_to_save_credentials' }, 500);
    }

    return json({ success: true, open_id: openId, display_name: displayName });
  } catch (err) {
    console.error('[tiktok-oauth-callback] unhandled', (err as Error).message);
    return json({ success: false, error: 'internal_error' }, 500);
  }
});
