/**
 * Cal.com — Token Helper
 *
 * Resolves a usable Cal.com access token for a given CRM user, refreshing it
 * via PKCE refresh_token grant when it is within 60s of expiry.
 *
 * INVARIANT: token rows are updated by `id`, never by `user_id`, so a future
 * multi-connection model won't clobber sibling rows.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CALCOM_TOKEN_URL = 'https://api.cal.com/v2/auth/oauth2/token';
const FALLBACK_CLIENT_ID = '3e2ebcc258be7431d30bcd255c4d46ac1fb3171738e3e247caf309f80ed08bd2';
const REFRESH_MARGIN_MS = 60_000; // refresh if expiring within 1 minute

export interface CalcomConnection {
  id: string;
  user_id: string;
  calcom_username: string | null;
  calcom_access_token: string | null;
  calcom_refresh_token: string | null;
  calcom_token_expires_at: string | null;
  default_event_type_id: number | null;
  default_event_type_slug: string | null;
  default_booking_url: string | null;
  webhook_id: string | null;
  webhook_secret: string | null;
  is_active: boolean | null;
}

/**
 * Resolves the Cal.com OAuth client id: settings table first, env fallback,
 * hardcoded PKCE public client id as last resort.
 */
export async function resolveCalcomClientId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('settings')
    .select('calcom_client_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (
    data?.calcom_client_id ||
    Deno.env.get('CALCOM_CLIENT_ID') ||
    FALLBACK_CLIENT_ID
  );
}

export async function getCalcomToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string; row: CalcomConnection } | null> {
  const { data: row } = await supabase
    .from('user_calcom_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!row || !row.calcom_access_token) {
    return null;
  }

  const conn = row as CalcomConnection;

  const expiresAt = conn.calcom_token_expires_at
    ? new Date(conn.calcom_token_expires_at).getTime()
    : 0;
  const needsRefresh = !expiresAt || expiresAt < Date.now() + REFRESH_MARGIN_MS;

  if (!needsRefresh) {
    return { accessToken: conn.calcom_access_token!, row: conn };
  }

  if (!conn.calcom_refresh_token) {
    // Can't refresh — return the current token and let the caller surface a 401.
    return { accessToken: conn.calcom_access_token!, row: conn };
  }

  const clientId = await resolveCalcomClientId(supabase);

  const res = await fetch(CALCOM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: conn.calcom_refresh_token,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.access_token) {
    console.error('calcom-client: refresh failed', { status: res.status, body: data });
    // Refresh failed — fall back to the stored (likely expired) token.
    return { accessToken: conn.calcom_access_token!, row: conn };
  }

  const newAccess: string = data.access_token;
  const newRefresh: string = data.refresh_token ?? conn.calcom_refresh_token;
  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : conn.calcom_token_expires_at;

  await supabase
    .from('user_calcom_connections')
    .update({
      calcom_access_token: newAccess,
      calcom_refresh_token: newRefresh,
      calcom_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id);

  return {
    accessToken: newAccess,
    row: { ...conn, calcom_access_token: newAccess, calcom_refresh_token: newRefresh, calcom_token_expires_at: newExpiresAt },
  };
}
