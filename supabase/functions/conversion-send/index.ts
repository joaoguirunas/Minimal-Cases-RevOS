/**
 * CONVERSION SEND — Ad Platform Conversion Event Dispatcher (v2)
 *
 * Processes pending events from conversion_events_queue and dispatches
 * to Meta Conversions API (CAPI) and/or Google Ads Offline Conversions.
 *
 * v2: Reads rule data (pixel_id, event_name, conversion_action) from
 * event_data JSONB. Credentials come from bi_ad_accounts + bi_settings.
 *
 * Invocation: pg_net HTTP call from DB trigger, or cron job.
 * Auth: service_role only (no user-facing endpoint).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const META_GRAPH_URL = 'https://graph.facebook.com/v25.0';
const GOOGLE_ADS_URL = 'https://googleads.googleapis.com/v23';
const MAX_RETRIES = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Meta CAPI ──────────────────────────────────────────────────────────────

async function sendToMeta(
  accessToken: string,
  pixelId: string,
  eventName: string,
  eventData: Record<string, unknown>,
  queueId: string,
  sendValue: boolean,
  log: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; response: unknown }> {

  const timestamp = (eventData.timestamp as number) || Math.floor(Date.now() / 1000);

  // Build user_data based on available matching keys
  const userData: Record<string, unknown> = {};

  if (eventData.fb_lead_id) {
    // Meta Lead Ads path: lead_id is the strongest match key
    userData.lead_id = Number(eventData.fb_lead_id);
  } else {
    // Site form path: cookies + hashed PII
    if (eventData.fbc) userData.fbc = eventData.fbc;
    if (eventData.fbp) userData.fbp = eventData.fbp;
    if (eventData.email_hash) userData.em = [eventData.email_hash];
    if (eventData.phone_hash) userData.ph = [eventData.phone_hash];
    if (eventData.ip_address) userData.client_ip_address = eventData.ip_address;
    if (eventData.user_agent) userData.client_user_agent = eventData.user_agent;
  }

  // Must have at least one matching key
  if (Object.keys(userData).length === 0) {
    return { success: false, response: { error: 'no_matching_keys' } };
  }

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: timestamp,
    action_source: 'system_generated',
    event_id: `evt-${queueId}`,
    user_data: userData,
    custom_data: {
      event_source: 'crm',
      lead_event_source: 'GrowthSales',
    },
  };

  // Add value if configured
  if (sendValue && eventData.value) {
    (event.custom_data as Record<string, unknown>).value = Number(eventData.value);
    (event.custom_data as Record<string, unknown>).currency = 'BRL';
  }

  const body: Record<string, unknown> = { data: [event] };

  log.info('meta_send', { pixel_id: pixelId, event_name: eventName });

  const resp = await fetch(
    `${META_GRAPH_URL}/${pixelId}/events?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  const respBody = await resp.json();

  if (!resp.ok) {
    log.error('meta_error', { status: resp.status, response: respBody });
    return { success: false, response: respBody };
  }

  log.info('meta_success', { events_received: respBody.events_received });
  return { success: true, response: respBody };
}

// ─── Google Ads ─────────────────────────────────────────────────────────────

async function getGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  return data.access_token || null;
}

async function sendToGoogle(
  accessToken: string,
  developerToken: string,
  customerId: string,
  conversionActionId: string,
  eventData: Record<string, unknown>,
  sendValue: boolean,
  currency: string,
  loginCustomerId: string | null,
  log: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; response: unknown }> {
  const gclid = eventData.gclid as string | null;

  if (!gclid) {
    return { success: false, response: { error: 'no_gclid' } };
  }

  const cid = customerId.replace(/-/g, '');
  const timestamp = eventData.timestamp as number;
  const convDate = new Date(timestamp * 1000);
  const tzOffset = '-03:00'; // BRT
  const dateStr = `${convDate.getFullYear()}-${String(convDate.getMonth() + 1).padStart(2, '0')}-${String(convDate.getDate()).padStart(2, '0')} ${String(convDate.getHours()).padStart(2, '0')}:${String(convDate.getMinutes()).padStart(2, '0')}:${String(convDate.getSeconds()).padStart(2, '0')}${tzOffset}`;

  const conversionAction = conversionActionId.includes('/')
    ? conversionActionId
    : `customers/${cid}/conversionActions/${conversionActionId}`;

  const conversion: Record<string, unknown> = {
    conversionAction,
    gclid,
    conversionDateTime: dateStr,
    conversionValue: sendValue && eventData.value ? Number(eventData.value) : 0,
    currencyCode: currency || 'BRL',
    orderId: `lead-${eventData.lead_id || 'unknown'}`,
    consent: { adUserData: 'GRANTED' },
  };

  // Enhanced conversions fallback
  const userIdentifiers: Record<string, string>[] = [];
  if (eventData.email_hash) userIdentifiers.push({ hashedEmail: eventData.email_hash as string });
  if (eventData.phone_hash) userIdentifiers.push({ hashedPhoneNumber: eventData.phone_hash as string });
  if (userIdentifiers.length > 0) {
    conversion.userIdentifiers = userIdentifiers;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
  };
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId.replace(/-/g, '');
  }

  log.info('google_send', { customer_id: cid, gclid: gclid.slice(0, 10) + '...' });

  const resp = await fetch(
    `${GOOGLE_ADS_URL}/customers/${cid}:uploadClickConversions`,
    { method: 'POST', headers, body: JSON.stringify({ conversions: [conversion], partialFailure: true }) },
  );

  const respBody = await resp.json();

  if (!resp.ok) {
    log.error('google_error', { status: resp.status, response: respBody });
    return { success: false, response: respBody };
  }

  if (respBody.partialFailureError) {
    log.warn('google_partial_failure', { error: respBody.partialFailureError });
    return { success: false, response: respBody };
  }

  log.info('google_success', { results: respBody.results?.length });
  return { success: true, response: respBody };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('conversion-send');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Fetch pending events (limit batch to 100)
    const { data: pendingEvents, error: fetchErr } = await supabase
      .from('conversion_events_queue')
      .select('*')
      .or('meta_status.eq.pending,google_status.eq.pending')
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(100);

    if (fetchErr) throw fetchErr;
    if (!pendingEvents?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log.info('processing_batch', { count: pendingEvents.length });

    // Collect unique user IDs for credential lookups
    const userIds = [...new Set(pendingEvents.map((e: Record<string, unknown>) => e.user_id as string))];

    // Fetch Meta ad accounts (access tokens)
    const { data: metaAdAccounts } = await supabase
      .from('bi_ad_accounts')
      .select('user_id, account_id, access_token')
      .eq('platform', 'meta')
      .eq('is_active', true)
      .in('user_id', userIds);

    // Fetch Google ad accounts (access/refresh tokens)
    const { data: googleAdAccounts } = await supabase
      .from('bi_ad_accounts')
      .select('user_id, account_id, access_token, refresh_token')
      .eq('platform', 'google')
      .eq('is_active', true)
      .in('user_id', userIds);

    // Fetch bi_settings for Google developer token and OAuth client
    const { data: biSettings } = await supabase
      .from('bi_settings')
      .select('google_developer_token, google_client_id, google_client_secret')
      .eq('singleton', true)
      .single();

    // Also check legacy conversion_platform_credentials as fallback
    const { data: legacyCreds } = await supabase
      .from('conversion_platform_credentials')
      .select('*')
      .in('user_id', userIds)
      .eq('is_active', true);

    let processed = 0;

    for (const evt of pendingEvents) {
      const event = evt as Record<string, unknown>;
      const userId = event.user_id as string;
      const queueId = event.id as string;
      const eventData = event.event_data as Record<string, unknown>;

      const update: Record<string, unknown> = {};

      // ── Meta CAPI ──────────────────────────────────────────────────────
      if ((event.meta_status as string) === 'pending') {
        const pixelId = eventData.meta_pixel_id as string;
        const metaEventName = eventData.meta_event_name as string;
        const metaSendValue = eventData.meta_send_value as boolean;

        if (!pixelId || !metaEventName) {
          update.meta_status = 'skipped';
          update.skip_reason = 'no_meta_config_in_rule';
        } else {
          // Find access token: try bi_ad_accounts first, then legacy creds
          const metaAccount = (metaAdAccounts || []).find(
            (a: Record<string, unknown>) => a.user_id === userId,
          );
          const legacyMeta = (legacyCreds || []).find(
            (c: Record<string, unknown>) => c.user_id === userId && c.platform === 'meta',
          );

          const accessToken = (metaAccount?.access_token as string)
            || ((legacyMeta?.credentials as Record<string, unknown>)?.access_token as string);

          if (!accessToken) {
            update.meta_status = 'skipped';
            update.skip_reason = 'no_meta_access_token';
          } else if (
            !eventData.fb_lead_id &&
            !eventData.fbc &&
            !eventData.fbp &&
            !eventData.email_hash
          ) {
            update.meta_status = 'skipped';
            update.skip_reason = 'no_attribution_data';
          } else {
            const result = await sendToMeta(
              accessToken,
              pixelId,
              metaEventName,
              eventData,
              queueId,
              metaSendValue,
              log,
            );
            update.meta_status = result.success ? 'sent' : 'failed';
            update.meta_response = result.response;
            update.meta_sent_at = new Date().toISOString();
          }
        }
      }

      // ── Google Ads ─────────────────────────────────────────────────────
      if ((event.google_status as string) === 'pending') {
        const googleAccountId = eventData.google_account_id as string;
        const googleConvActionId = eventData.google_conversion_action_id as string;
        const googleSendValue = eventData.google_send_value as boolean;
        const googleCurrency = (eventData.google_currency as string) || 'BRL';

        if (!googleAccountId || !googleConvActionId) {
          update.google_status = 'skipped';
          if (!update.skip_reason) update.skip_reason = 'no_google_config_in_rule';
        } else if (!eventData.gclid) {
          update.google_status = 'skipped';
          if (!update.skip_reason) update.skip_reason = 'no_gclid';
        } else {
          // Find credentials
          const googleAccount = (googleAdAccounts || []).find(
            (a: Record<string, unknown>) =>
              a.user_id === userId &&
              (a.account_id as string).replace(/-/g, '') === googleAccountId.replace(/-/g, ''),
          );
          const legacyGoogle = (legacyCreds || []).find(
            (c: Record<string, unknown>) => c.user_id === userId && c.platform === 'google',
          );

          const refreshToken = (googleAccount?.refresh_token as string)
            || ((legacyGoogle?.credentials as Record<string, unknown>)?.oauth_refresh_token as string);
          const developerToken = (biSettings?.google_developer_token as string)
            || ((legacyGoogle?.credentials as Record<string, unknown>)?.developer_token as string);
          const clientId = (biSettings?.google_client_id as string)
            || Deno.env.get('GOOGLE_ADS_CLIENT_ID');
          const clientSecret = (biSettings?.google_client_secret as string)
            || Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');

          if (!refreshToken || !developerToken || !clientId || !clientSecret) {
            update.google_status = 'skipped';
            if (!update.skip_reason) update.skip_reason = 'no_google_credentials';
          } else {
            const accessToken = await getGoogleAccessToken(refreshToken, clientId, clientSecret);
            if (!accessToken) {
              update.google_status = 'failed';
              update.google_response = { error: 'oauth_token_refresh_failed' };
            } else {
              const result = await sendToGoogle(
                accessToken,
                developerToken,
                googleAccountId,
                googleConvActionId,
                eventData,
                googleSendValue,
                googleCurrency,
                null,
                log,
              );
              update.google_status = result.success ? 'sent' : 'failed';
              update.google_response = result.response;
              update.google_sent_at = new Date().toISOString();
            }
          }
        }
      }

      // Increment retry count on failures
      if (update.meta_status === 'failed' || update.google_status === 'failed') {
        update.retry_count = ((event.retry_count as number) || 0) + 1;
      }

      await supabase
        .from('conversion_events_queue')
        .update(update)
        .eq('id', queueId);

      processed++;
    }

    log.info('batch_complete', { processed });

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('fatal', { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
