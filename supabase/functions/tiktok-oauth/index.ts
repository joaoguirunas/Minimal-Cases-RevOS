/**
 * TikTok OAuth — DMs OAuth Callback Handler (T-08)
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy tiktok-oauth --no-verify-jwt
 *
 * Register this URL in TikTok Developer App:
 *   Redirect URI for OAuth → {SUPABASE_URL}/functions/v1/tiktok-oauth
 *
 * Flow:
 *   1. User clicks "Conectar TikTok" → redirected to TikTok OAuth
 *   2. TikTok → user authorizes → GET here with ?code=xxx&state=xxx
 *   3. POST https://open.tiktokapis.com/v2/oauth/token/ — exchange code for tokens
 *   4. POST https://open.tiktokapis.com/v2/user/info/ — fetch profile
 *   5. UPSERT omni_channel_configs (channel='tiktok') with credentials
 *   6. Redirect to APP_URL/settings/omni/tiktok?connected=1
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TIKTOK_APP_ID       — client_key from TikTok Developer App
 *   TIKTOK_APP_SECRET   — client_secret from TikTok Developer App
 *   APP_URL             — Frontend URL (e.g. https://revos.growthsales.ai)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

// ── Helpers ───────────────────────────────────────────────────────────────────

function redirectTo(appUrl: string, path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${appUrl}${path}` },
  });
}

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

/**
 * Exchange authorization code for access_token + refresh_token.
 * TikTok token endpoint accepts application/x-www-form-urlencoded.
 */
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
    console.error('[tiktok-oauth] exchangeCode failed', resp.status, raw);
    return null;
  }

  try {
    const data = JSON.parse(raw) as TikTokTokenResponse;
    if (data.error) {
      console.error('[tiktok-oauth] token error', data.error, data.error_description);
      return null;
    }
    return data;
  } catch {
    console.error('[tiktok-oauth] exchangeCode parse error', raw);
    return null;
  }
}

interface TikTokUserInfo {
  open_id: string;
  display_name: string;
  avatar_url: string;
}

/**
 * Fetch TikTok user profile using the access token.
 * TikTok user/info endpoint uses POST with a JSON body specifying fields.
 */
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
    console.error('[tiktok-oauth] fetchUserInfo failed', resp.status, raw);
    return null;
  }

  try {
    const data = JSON.parse(raw) as { data?: { user?: TikTokUserInfo } };
    return data?.data?.user ?? null;
  } catch {
    console.error('[tiktok-oauth] fetchUserInfo parse error', raw);
    return null;
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const appId          = Deno.env.get('TIKTOK_APP_ID') ?? '';
  const appSecret      = Deno.env.get('TIKTOK_APP_SECRET') ?? '';
  const appUrl         = Deno.env.get('APP_URL') ?? '';

  const log = createLogger('tiktok-oauth');
  const url = new URL(req.url);

  // The redirect_uri must match exactly what's registered in TikTok Developer App
  const redirectUri = `${supabaseUrl}/functions/v1/tiktok-oauth`;

  // ── Error from TikTok (user denied, etc.) ─────────────────────────────────
  const error = url.searchParams.get('error') ?? url.searchParams.get('error_code');
  if (error) {
    const desc = url.searchParams.get('error_description') ?? error;
    log.warn('oauth_denied', { error, desc });
    return redirectTo(appUrl, `/settings/omni/tiktok?error=${encodeURIComponent(desc)}`);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    log.warn('no_code');
    return redirectTo(appUrl, '/settings/omni/tiktok?error=no_code');
  }

  if (!appId || !appSecret) {
    log.error('missing_env', { has_app_id: !!appId, has_app_secret: !!appSecret });
    return redirectTo(appUrl, '/settings/omni/tiktok?error=app_not_configured');
  }

  try {
    // Step 1 — Exchange authorization code for tokens
    log.info('exchanging_code', { code_prefix: code.slice(0, 8) });
    const tokens = await exchangeCode(code, redirectUri, appId, appSecret);
    if (!tokens?.access_token) {
      log.error('code_exchange_failed');
      return redirectTo(appUrl, '/settings/omni/tiktok?error=code_exchange_failed');
    }

    const tokenExpiresAt        = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString();

    log.info('tokens_received', {
      open_id: tokens.open_id,
      expires_in: tokens.expires_in,
      refresh_expires_in: tokens.refresh_expires_in,
    });

    // Step 2 — Fetch user profile
    const userInfo = await fetchUserInfo(tokens.access_token);
    // Non-fatal: if profile fetch fails we still have open_id from token response
    const openId      = userInfo?.open_id      ?? tokens.open_id;
    const displayName = userInfo?.display_name ?? `TikTok ${tokens.open_id.slice(-6)}`;
    const avatarUrl   = userInfo?.avatar_url    ?? '';

    log.info('user_info', { open_id: openId, display_name: displayName });

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
      app_secret:               appSecret, // stored for webhook HMAC verification
    };

    const { error: upsertErr } = await supabase
      .from('omni_channel_configs')
      .upsert(
        { channel: 'tiktok', is_active: true, credentials },
        { onConflict: 'channel' },
      );

    if (upsertErr) {
      log.error('upsert_failed', { error: upsertErr.message });
      return redirectTo(appUrl, `/settings/omni/tiktok?error=${encodeURIComponent(upsertErr.message)}`);
    }

    log.info('credentials_saved', { open_id: openId, channel: 'tiktok' });

    // Step 4 — Redirect back to config page with success flag
    return redirectTo(appUrl, '/settings/omni/tiktok?connected=1');
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });
    return redirectTo(appUrl, `/settings/omni/tiktok?error=${encodeURIComponent(errMsg)}`);
  }
});
