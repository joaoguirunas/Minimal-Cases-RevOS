/**
 * TikTok Outbound — Send DMs via TikTok Messaging API v2 (T-10)
 *
 * ⚠️  DEPLOY: use --no-verify-jwt (called from frontend + internal)
 *     supabase functions deploy tiktok-outbound --no-verify-jwt
 *
 * Called by omni-delivery-engine or directly from OMNI PRO frontend
 * for channel='tiktok' messages.
 *
 * API endpoint:
 *   POST https://open.tiktokapis.com/v2/dm/conversation/message/send/
 *   Authorization: Bearer {access_token}
 *
 * Request body:
 *   {
 *     "people_id": "uuid",
 *     "message":   "text content",
 *     "message_id": "optional local DB message id to update status"
 *   }
 *
 * Flow:
 *   1. Fetch tiktok_open_id from clients_people
 *   2. getValidAccessToken() — lazy refresh if < 1h remaining
 *   3. POST to TikTok API with exponential backoff (3 attempts)
 *   4. UPDATE messages.status if message_id provided
 *   5. On failure: INSERT omni_delivery_dead_letter
 *
 * Messaging window:
 *   TikTok allows replies only within 7 days of the last inbound message.
 *   This is enforced at the UI level (useCanSendMessage). This function
 *   does NOT enforce the window itself — it forwards the API error if it occurs.
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TIKTOK_APP_ID, TIKTOK_APP_SECRET  — for token refresh
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutboundRequest {
  people_id:   string;
  message:     string;
  message_id?: string | number; // local DB messages.id to update status on success
}

interface TikTokCredentials {
  open_id?:                  string;
  access_token?:             string;
  refresh_token?:            string;
  token_expires_at?:         string;
  refresh_token_expires_at?: string;
  app_id?:                   string;
  app_secret?:               string;
}

// ── Token Management ──────────────────────────────────────────────────────────

/**
 * Lazy token refresh: if access_token expires within 1 hour, refresh it now.
 * Returns a valid access_token ready to use.
 */
async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
): Promise<string> {
  const { data: cfg } = await supabase
    .from('omni_channel_configs')
    .select('credentials')
    .eq('channel', 'tiktok')
    .eq('is_active', true)
    .single() as unknown as { data: { credentials: TikTokCredentials } | null };

  if (!cfg?.credentials?.access_token) {
    throw new Error('TikTok channel not configured or missing access_token');
  }

  const creds = cfg.credentials;
  const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
  const now = new Date();

  // Refresh if token expires within 1 hour
  if (expiresAt && (expiresAt.getTime() - now.getTime()) > 3600 * 1000) {
    log.info('token_still_valid', { expires_at: creds.token_expires_at });
    return creds.access_token!;
  }

  log.info('token_needs_refresh', {
    expires_at: creds.token_expires_at,
    ms_remaining: expiresAt ? expiresAt.getTime() - now.getTime() : -1,
  });

  // Call tiktok-token-refresh as a supabase function invoke
  // Falls back to inline refresh if function invocation fails
  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const refreshResp = await fetch(`${supabaseUrl}/functions/v1/tiktok-token-refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force: true }),
    });

    if (refreshResp.ok) {
      const result = await refreshResp.json() as { access_token?: string; status?: string };
      if (result.access_token) {
        log.info('token_refreshed_via_function', {});
        return result.access_token;
      }
    }
  } catch (e) {
    log.warn('token_refresh_function_failed', { error: (e as Error).message });
  }

  // Inline fallback refresh
  return await refreshTokenInline(supabase, creds, log);
}

async function refreshTokenInline(
  supabase: ReturnType<typeof createClient>,
  creds: TikTokCredentials,
  log: ReturnType<typeof createLogger>,
): Promise<string> {
  const appId     = creds.app_id     ?? Deno.env.get('TIKTOK_APP_ID')     ?? '';
  const appSecret = creds.app_secret ?? Deno.env.get('TIKTOK_APP_SECRET') ?? '';

  if (!creds.refresh_token || !appId || !appSecret) {
    throw new Error('Cannot refresh token: missing refresh_token, app_id, or app_secret');
  }

  const body = new URLSearchParams({
    client_key:    appId,
    client_secret: appSecret,
    grant_type:    'refresh_token',
    refresh_token: creds.refresh_token,
  });

  const resp = await fetch(`${TIKTOK_API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const raw = await resp.text();
  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status} ${raw}`);

  const data = JSON.parse(raw) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
    error?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(`Token refresh API error: ${data.error ?? 'empty response'}`);
  }

  const tokenExpiresAt        = new Date(Date.now() + data.expires_in * 1000).toISOString();
  const refreshTokenExpiresAt = new Date(Date.now() + data.refresh_expires_in * 1000).toISOString();

  // Persist new tokens
  await supabase
    .from('omni_channel_configs')
    .update({
      credentials: {
        ...creds,
        access_token:             data.access_token,
        refresh_token:            data.refresh_token,
        token_expires_at:         tokenExpiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
      },
    })
    .eq('channel', 'tiktok');

  log.info('token_refreshed_inline', { expires_at: tokenExpiresAt });
  return data.access_token;
}

// ── TikTok API: Send DM ────────────────────────────────────────────────────────

interface TikTokSendResult {
  success: boolean;
  tiktok_message_id?: string;
  error?: string;
  status_code?: number;
}

/**
 * Send a text DM via TikTok Messaging API v2.
 * Implements exponential backoff: 3 attempts, delays: 500ms, 2000ms.
 */
async function sendTikTokDM(
  receiverOpenId: string,
  text: string,
  accessToken: string,
  log: ReturnType<typeof createLogger>,
): Promise<TikTokSendResult> {
  const url = `${TIKTOK_API}/dm/conversation/message/send/`;
  const payload = {
    receiver_open_id: receiverOpenId,
    message: {
      message_type: 'text',
      text,
    },
  };

  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS   = [500, 2000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(payload),
      });

      const raw = await resp.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw); } catch { /* non-JSON response */ }

      if (resp.ok && !data.error) {
        const tiktokMsgId = (data.data as Record<string, unknown>)?.message_id as string | undefined;
        log.info('tiktok_sent', { receiver_id: receiverOpenId, attempt, tiktok_msg_id: tiktokMsgId });
        return { success: true, tiktok_message_id: tiktokMsgId };
      }

      // 429 Rate limit or 5xx — retry
      const retryable = resp.status === 429 || resp.status >= 500;
      log.warn('tiktok_send_failed', {
        attempt,
        status: resp.status,
        error: data.error ?? raw.slice(0, 200),
        retryable,
      });

      if (!retryable || attempt === MAX_ATTEMPTS) {
        return {
          success: false,
          error: `${resp.status}: ${data.error ?? raw.slice(0, 200)}`,
          status_code: resp.status,
        };
      }

    } catch (err) {
      log.warn('tiktok_send_exception', { attempt, error: (err as Error).message });
      if (attempt === MAX_ATTEMPTS) {
        return { success: false, error: (err as Error).message };
      }
    }

    // Wait before retry (exponential backoff)
    await new Promise(r => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 4000));
  }

  return { success: false, error: 'max_attempts_reached' };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('tiktok-outbound');
  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase       = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json() as OutboundRequest;
    const { people_id, message, message_id } = body;

    if (!people_id || !message) {
      return new Response(
        JSON.stringify({ error: 'people_id and message are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // ── 1. Fetch recipient's tiktok_open_id ──────────────────────────────────
    const { data: person } = await supabase
      .from('clients_people')
      .select('id, name, tiktok_open_id')
      .eq('id', people_id)
      .single() as unknown as {
        data: { id: string; name: string; tiktok_open_id: string | null } | null;
      };

    if (!person?.tiktok_open_id) {
      log.error('no_tiktok_open_id', { people_id });
      return new Response(
        JSON.stringify({ error: 'Person has no tiktok_open_id — cannot send TikTok DM' }),
        { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    log.info('sending_dm', { people_id, receiver_id: person.tiktok_open_id });

    // ── 2. Get valid access token (lazy refresh if < 1h remaining) ───────────
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabase, log);
    } catch (err) {
      log.error('token_error', { error: (err as Error).message });

      // Insert dead letter so operator is alerted
      await supabase.from('omni_delivery_dead_letter').insert({
        channel:    'tiktok',
        people_id,
        message,
        error:      (err as Error).message,
        reason:     'token_error',
      }).catch(() => {});

      return new Response(
        JSON.stringify({ error: 'Token error: ' + (err as Error).message }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // ── 3. Send DM via TikTok API ─────────────────────────────────────────────
    const result = await sendTikTokDM(person.tiktok_open_id, message, accessToken, log);

    // ── 4. Update message status in DB if message_id provided ────────────────
    if (message_id) {
      if (result.success) {
        await supabase
          .from('messages')
          .update({
            status: 'sent',
            metadata: { tiktok_message_id: result.tiktok_message_id },
          })
          .eq('id', message_id);
      } else {
        await supabase
          .from('messages')
          .update({ status: 'failed' })
          .eq('id', message_id);
      }
    }

    // ── 5. Dead letter on failure ─────────────────────────────────────────────
    if (!result.success) {
      log.error('send_failed', {
        people_id,
        receiver_id: person.tiktok_open_id,
        error: result.error,
      });

      await supabase.from('omni_delivery_dead_letter').insert({
        channel:    'tiktok',
        people_id,
        message,
        error:      result.error,
        reason:     result.status_code === 429 ? 'rate_limited' : 'api_error',
      }).catch(() => {});

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, tiktok_message_id: result.tiktok_message_id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );

  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
