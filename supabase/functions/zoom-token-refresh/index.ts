/**
 * Schedule PRO™ — Zoom Token Auto-Refresh
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy zoom-token-refresh --no-verify-jwt
 *     (called by pg_cron via service role — no Supabase JWT)
 *
 * Triggered by pg_cron every 30 minutes.
 * Refreshes Zoom OAuth tokens that expire within 45 minutes.
 * Zoom access tokens expire in 1 hour — proactive refresh prevents failures in zoom-upsert-event.
 *
 * Story: FIX-SCH-02
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const REFRESH_THRESHOLD_MINUTES = 45;

Deno.serve(async (_req: Request) => {
  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const log = createLogger('zoom-token-refresh');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Fetch Zoom app credentials from bi_settings
    const { data: biSettings } = await supabase
      .from('bi_settings')
      .select('zoom_client_id, zoom_client_secret')
      .limit(1)
      .maybeSingle();

    const clientId     = biSettings?.zoom_client_id     ?? Deno.env.get('ZOOM_CLIENT_ID')     ?? '';
    const clientSecret = biSettings?.zoom_client_secret ?? Deno.env.get('ZOOM_CLIENT_SECRET') ?? '';

    if (!clientId || !clientSecret) {
      log.warn('no_zoom_credentials', { reason: 'zoom_client_id or zoom_client_secret missing from bi_settings' });
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no zoom credentials configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find all active Zoom connections expiring within threshold
    const thresholdTs = new Date(Date.now() + REFRESH_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    const { data: connections, error: fetchErr } = await supabase
      .from('user_calendar_connections')
      .select('user_id, zoom_access_token, zoom_refresh_token, zoom_token_expires_at')
      .eq('provider', 'zoom')
      .eq('is_active', true)
      .not('zoom_refresh_token', 'is', null)
      .or(`zoom_token_expires_at.is.null,zoom_token_expires_at.lte.${thresholdTs}`);

    if (fetchErr) {
      log.error('fetch_connections_failed', { error: fetchErr.message });
      return new Response(JSON.stringify({ status: 'error', reason: fetchErr.message }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!connections || connections.length === 0) {
      log.info('no_tokens_to_refresh', { threshold_minutes: REFRESH_THRESHOLD_MINUTES });
      return new Response(JSON.stringify({ status: 'ok', refreshed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      try {
        const resp = await fetch(ZOOM_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token: conn.zoom_refresh_token as string,
          }),
        });

        const data = await resp.json();

        if (!resp.ok || !data.access_token) {
          log.warn('token_refresh_failed', { user_id: conn.user_id, error: data.reason || data.error });
          errors.push(`user_id=${conn.user_id}: ${data.reason || data.error || resp.status}`);
          failed++;
          continue;
        }

        const newExpiresAt = new Date(Date.now() + ((data.expires_in as number) || 3600) * 1000).toISOString();

        const { error: updateErr } = await supabase
          .from('user_calendar_connections')
          .update({
            zoom_access_token:     data.access_token,
            zoom_token_expires_at: newExpiresAt,
            ...(data.refresh_token ? { zoom_refresh_token: data.refresh_token } : {}),
          })
          .eq('user_id', conn.user_id)
          .eq('provider', 'zoom');

        if (updateErr) {
          log.error('token_update_failed', { user_id: conn.user_id, error: updateErr.message });
          errors.push(`user_id=${conn.user_id}: db update failed: ${updateErr.message}`);
          failed++;
          continue;
        }

        log.info('token_refreshed', { user_id: conn.user_id, expires_at: newExpiresAt });
        refreshed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error('token_refresh_exception', { user_id: conn.user_id, error: msg });
        errors.push(`user_id=${conn.user_id}: ${msg}`);
        failed++;
      }
    }

    return new Response(JSON.stringify({ status: 'ok', refreshed, failed, errors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('unhandled', { error: errMsg });
    return new Response(JSON.stringify({ status: 'error', reason: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
