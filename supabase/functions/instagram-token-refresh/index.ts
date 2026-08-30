/**
 * Instagram Token Auto-Refresh — pg_cron Daily Job
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy instagram-token-refresh --no-verify-jwt
 *
 * Triggered by pg_cron daily at 03:00 UTC.
 * Checks if Instagram access token expires within 7 days.
 * If so, exchanges for a new long-lived token via Meta Graph API.
 *
 * Story: OP-03 (Epic OMNI-PRO-V2)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const META_GRAPH = 'https://graph.facebook.com/v25.0';
const REFRESH_THRESHOLD_DAYS = 7;

// ── Token Exchange ───────────────────────────────────────────────────────────

async function exchangeLongLived(
  currentToken: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', currentToken);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Meta API ${resp.status}: ${body}`);
  }
  return resp.json() as Promise<{ access_token: string; expires_in: number }>;
}

// ── Alert Insert ─────────────────────────────────────────────────────────────

async function insertAlert(
  supabase: ReturnType<typeof createClient>,
  channel: string,
  alertType: string,
  severity: 'info' | 'warning' | 'error',
  title: string,
  details: Record<string, unknown> = {},
) {
  await supabase
    .from('omni_channel_alerts')
    .insert({ channel, alert_type: alertType, severity, title, details });
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const log = createLogger('instagram-token-refresh');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch Instagram channel config
    const { data: config, error: fetchErr } = await supabase
      .from('omni_channel_configs')
      .select('*')
      .eq('channel', 'instagram')
      .eq('is_active', true)
      .single();

    if (fetchErr || !config) {
      log.info('no_active_instagram_config', { error: fetchErr?.message });
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no active instagram config' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const credentials = (config.credentials ?? {}) as Record<string, string>;
    const { access_token, token_expires_at, app_secret } = credentials;
    // app_id was not stored by earlier versions of instagram-oauth — fall back to env var
    const app_id = credentials.app_id || Deno.env.get('INSTAGRAM_APP_ID') || '';

    // 2. Check if token exists and has expiration info
    if (!access_token) {
      log.warn('no_access_token');
      await insertAlert(supabase, 'instagram', 'token_missing', 'error',
        'Token de acesso do Instagram não configurado',
        { reason: 'access_token is empty in omni_channel_configs' },
      );
      return new Response(JSON.stringify({ status: 'error', reason: 'no access_token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!app_id || !app_secret) {
      log.warn('missing_app_credentials');
      await insertAlert(supabase, 'instagram', 'token_refresh_failed', 'error',
        'Credenciais do app Meta não configuradas',
        { reason: 'app_id or app_secret missing — cannot refresh token' },
      );
      return new Response(JSON.stringify({ status: 'error', reason: 'missing app_id/app_secret' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Check if token needs refresh
    const now = new Date();
    const expiresAt = token_expires_at ? new Date(token_expires_at) : null;
    const daysUntilExpiry = expiresAt
      ? (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      : -1; // no expiry info → treat as needing refresh

    if (expiresAt && daysUntilExpiry > REFRESH_THRESHOLD_DAYS) {
      log.info('token_still_valid', {
        expires_at: token_expires_at,
        days_remaining: Math.round(daysUntilExpiry),
      });
      return new Response(JSON.stringify({
        status: 'ok',
        reason: 'token still valid',
        days_remaining: Math.round(daysUntilExpiry),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Token needs refresh — exchange for new long-lived token
    log.info('refreshing_token', {
      expires_at: token_expires_at,
      days_remaining: Math.round(daysUntilExpiry),
    });

    const result = await exchangeLongLived(access_token, app_id, app_secret);

    if (!result?.access_token) {
      log.error('token_refresh_failed', { reason: 'empty response from Meta' });
      await insertAlert(supabase, 'instagram', 'token_refresh_failed', 'error',
        'Falha ao renovar token do Instagram',
        { reason: 'Meta API returned empty response', expires_at: token_expires_at },
      );
      return new Response(JSON.stringify({ status: 'error', reason: 'refresh failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Update credentials with new token
    const newExpiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();
    const updatedCredentials = {
      ...credentials,
      access_token: result.access_token,
      token_expires_at: newExpiresAt,
    };

    const { error: updateErr } = await supabase
      .from('omni_channel_configs')
      .update({ credentials: updatedCredentials })
      .eq('channel', 'instagram');

    if (updateErr) {
      log.error('update_failed', { error: updateErr.message });
      await insertAlert(supabase, 'instagram', 'token_refresh_failed', 'error',
        'Falha ao salvar novo token do Instagram',
        { reason: updateErr.message },
      );
      return new Response(JSON.stringify({ status: 'error', reason: 'db update failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Log success
    const newDaysRemaining = Math.round(result.expires_in / 86400);
    log.info('token_refreshed', {
      new_expires_at: newExpiresAt,
      new_days_remaining: newDaysRemaining,
    });

    await insertAlert(supabase, 'instagram', 'token_refreshed', 'info',
      `Token do Instagram renovado — válido por ${newDaysRemaining} dias`,
      {
        new_expires_at: newExpiresAt,
        days_remaining: newDaysRemaining,
        old_expires_at: token_expires_at,
      },
    );

    return new Response(JSON.stringify({
      status: 'refreshed',
      new_expires_at: newExpiresAt,
      days_remaining: newDaysRemaining,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });

    try {
      await insertAlert(supabase, 'instagram', 'token_refresh_failed', 'error',
        'Erro inesperado ao renovar token do Instagram',
        { error: errMsg },
      );
    } catch {
      // alert insert failed — log only
    }

    return new Response(JSON.stringify({ status: 'error', reason: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
