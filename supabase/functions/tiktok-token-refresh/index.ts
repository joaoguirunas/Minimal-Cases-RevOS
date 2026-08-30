/**
 * TikTok Token Refresh — Auto-refresh access_token every 12h via pg_cron (T-11)
 *
 * ⚠️  DEPLOY: use --no-verify-jwt (called by pg_cron HTTP POST)
 *     supabase functions deploy tiktok-token-refresh --no-verify-jwt
 *
 * TikTok access_token TTL: 24h (vs Meta ~60 days)
 * This function must run every 12h to ensure the token never expires in prod.
 *
 * Triggered by pg_cron:
 *   SELECT cron.schedule(
 *     'tiktok-token-refresh',
 *     '0 *\/12 * * *',
 *     $$SELECT net.http_post(
 *       url := current_setting('app.supabase_url') || '/functions/v1/tiktok-token-refresh',
 *       headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb,
 *       body := '{}'::jsonb
 *     )$$
 *   );
 *
 * Also called lazily by tiktok-outbound before API calls (via HTTP invoke).
 *
 * Flow:
 *   1. Fetch omni_channel_configs WHERE channel='tiktok' AND is_active=true
 *   2. Skip if no config or no refresh_token
 *   3. Skip if access_token still valid for > 4h (configurable via body.force=true)
 *   4. POST https://open.tiktokapis.com/v2/oauth/token/ (grant_type=refresh_token)
 *   5. UPDATE omni_channel_configs.credentials with new tokens
 *   6. INSERT omni_channel_alerts (info on success, error on failure)
 *   7. Return { status, access_token (on success), error (on failure) }
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TIKTOK_APP_ID     — client_key (fallback if not in stored credentials)
 *   TIKTOK_APP_SECRET — client_secret (fallback if not in stored credentials)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

// Refresh if token expires within this threshold
const REFRESH_THRESHOLD_HOURS = 4;

// ── Types ─────────────────────────────────────────────────────────────────────

interface TikTokCredentials {
  open_id?:                  string;
  display_name?:             string;
  avatar_url?:               string;
  access_token?:             string;
  refresh_token?:            string;
  token_expires_at?:         string;
  refresh_token_expires_at?: string;
  app_id?:                   string;
  app_secret?:               string;
}

interface RefreshTokenResponse {
  access_token:       string;
  expires_in:         number;   // 86400 = 24h
  refresh_token:      string;
  refresh_expires_in: number;   // 31536000 = 365 days
  open_id:            string;
  scope:              string;
  token_type:         string;
  error?:             string;
  error_description?: string;
}

// ── Alert Insert ──────────────────────────────────────────────────────────────

async function insertAlert(
  supabase: ReturnType<typeof createClient>,
  alertType: string,
  severity: 'info' | 'warning' | 'error',
  title: string,
  details: Record<string, unknown> = {},
) {
  await supabase
    .from('omni_channel_alerts')
    .insert({ channel: 'tiktok', alert_type: alertType, severity, title, details })
    .catch(() => {/* non-fatal */});
}

// ── Token Refresh ─────────────────────────────────────────────────────────────

async function refreshTikTokToken(
  refreshToken: string,
  appId: string,
  appSecret: string,
): Promise<RefreshTokenResponse> {
  const body = new URLSearchParams({
    client_key:    appId,
    client_secret: appSecret,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });

  const resp = await fetch(`${TIKTOK_API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    throw new Error(`TikTok token refresh HTTP ${resp.status}: ${raw}`);
  }

  const data = JSON.parse(raw) as RefreshTokenResponse;
  if (data.error) {
    throw new Error(`TikTok token refresh API error: ${data.error} — ${data.error_description ?? ''}`);
  }
  if (!data.access_token) {
    throw new Error('TikTok token refresh: empty access_token in response');
  }

  return data;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const log = createLogger('tiktok-token-refresh');
  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const envAppId       = Deno.env.get('TIKTOK_APP_ID')     ?? '';
  const envAppSecret   = Deno.env.get('TIKTOK_APP_SECRET') ?? '';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Optional body param `force: true` bypasses the threshold check
  let force = false;
  try {
    const body = await req.json() as { force?: boolean };
    force = body.force === true;
  } catch { /* ignore parse errors — pg_cron may send empty body */ }

  try {
    // ── 1. Fetch active TikTok channel config ───────────────────────────────
    const { data: config, error: fetchErr } = await supabase
      .from('omni_channel_configs')
      .select('credentials')
      .eq('channel', 'tiktok')
      .eq('is_active', true)
      .single() as unknown as {
        data: { credentials: TikTokCredentials } | null;
        error: { message: string } | null;
      };

    if (fetchErr || !config) {
      log.info('no_active_tiktok_config', { error: fetchErr?.message });
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no active tiktok config' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const creds = config.credentials;

    // ── 2. Check required credentials ──────────────────────────────────────
    if (!creds.refresh_token) {
      log.warn('no_refresh_token');
      await insertAlert(supabase, 'token_missing', 'error',
        'TikTok refresh_token não configurado — reconecte a conta TikTok',
        { reason: 'refresh_token is empty in omni_channel_configs' },
      );
      return new Response(
        JSON.stringify({ status: 'error', reason: 'no refresh_token' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const appId     = creds.app_id     ?? envAppId;
    const appSecret = creds.app_secret ?? envAppSecret;

    if (!appId || !appSecret) {
      log.warn('missing_app_credentials');
      await insertAlert(supabase, 'token_refresh_failed', 'error',
        'Credenciais do app TikTok não configuradas (app_id / app_secret)',
        { reason: 'app_id or app_secret missing' },
      );
      return new Response(
        JSON.stringify({ status: 'error', reason: 'missing app_id/app_secret' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Check if refresh is needed ─────────────────────────────────────
    const now = new Date();
    const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
    const hoursRemaining = expiresAt
      ? (expiresAt.getTime() - now.getTime()) / (1000 * 3600)
      : -1; // unknown → force refresh

    if (!force && expiresAt && hoursRemaining > REFRESH_THRESHOLD_HOURS) {
      log.info('token_still_valid', {
        expires_at: creds.token_expires_at,
        hours_remaining: Math.round(hoursRemaining),
      });
      return new Response(JSON.stringify({
        status: 'ok',
        reason: 'token still valid',
        hours_remaining: Math.round(hoursRemaining),
        expires_at: creds.token_expires_at,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── 4. Refresh the token ───────────────────────────────────────────────
    log.info('refreshing_token', {
      expires_at:    creds.token_expires_at,
      hours_remaining: Math.round(hoursRemaining),
      forced: force,
    });

    const result = await refreshTikTokToken(creds.refresh_token, appId, appSecret);

    // ── 5. Persist new tokens ──────────────────────────────────────────────
    const newTokenExpiresAt        = new Date(Date.now() + result.expires_in        * 1000).toISOString();
    const newRefreshTokenExpiresAt = new Date(Date.now() + result.refresh_expires_in * 1000).toISOString();

    const updatedCredentials: TikTokCredentials = {
      ...creds,
      access_token:             result.access_token,
      refresh_token:            result.refresh_token,
      token_expires_at:         newTokenExpiresAt,
      refresh_token_expires_at: newRefreshTokenExpiresAt,
    };

    const { error: updateErr } = await supabase
      .from('omni_channel_configs')
      .update({ credentials: updatedCredentials })
      .eq('channel', 'tiktok');

    if (updateErr) {
      log.error('db_update_failed', { error: updateErr.message });
      await insertAlert(supabase, 'token_refresh_failed', 'error',
        'Falha ao salvar novo token TikTok no banco',
        { reason: updateErr.message },
      );
      return new Response(
        JSON.stringify({ status: 'error', reason: 'db update failed: ' + updateErr.message }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── 6. Log success ─────────────────────────────────────────────────────
    const newHoursRemaining = Math.round(result.expires_in / 3600);
    log.info('token_refreshed', {
      new_expires_at:  newTokenExpiresAt,
      hours_remaining: newHoursRemaining,
    });

    await insertAlert(supabase, 'token_refreshed', 'info',
      `Token TikTok renovado — válido por ${newHoursRemaining}h`,
      {
        new_expires_at:         newTokenExpiresAt,
        hours_remaining:        newHoursRemaining,
        old_expires_at:         creds.token_expires_at,
        refresh_token_expires_at: newRefreshTokenExpiresAt,
      },
    );

    return new Response(JSON.stringify({
      status:        'refreshed',
      access_token:  result.access_token,  // returned so tiktok-outbound can use directly
      expires_at:    newTokenExpiresAt,
      hours_remaining: newHoursRemaining,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });

    await insertAlert(supabase, 'token_refresh_failed', 'error',
      'Erro inesperado ao renovar token TikTok',
      { error: errMsg },
    ).catch(() => {});

    return new Response(
      JSON.stringify({ status: 'error', reason: errMsg }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
