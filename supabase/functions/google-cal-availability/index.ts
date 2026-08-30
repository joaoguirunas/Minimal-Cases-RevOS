/**
 * Schedule PRO™ — Google Calendar Availability (FreeBusy)
 *
 * POST /google-cal-availability
 * Body: { user_id: string, date: string }  // date = 'YYYY-MM-DD'
 *
 * Returns: { busy: [{ start: string, end: string }] }
 * If user has no calendar connection → returns { busy: [] } (graceful)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(null, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Invalid token' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === OAuth credentials: settings (CFG-05) → bi_settings fallback → env ===
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('google_client_id, google_client_secret')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let clientId = settingsRow?.google_client_id ?? '';
    let clientSecret = settingsRow?.google_client_secret ?? '';
    if (!clientId || !clientSecret) {
      const { data: biRow } = await supabase
        .from('bi_settings')
        .select('google_client_id, google_client_secret')
        .limit(1)
        .maybeSingle();
      clientId = clientId || (biRow?.google_client_id ?? Deno.env.get('GOOGLE_CLIENT_ID') ?? '');
      clientSecret = clientSecret || (biRow?.google_client_secret ?? Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '');
    }

    // === PARSE BODY ===
    const body = await req.json();
    const { user_id, date } = body as { user_id: string; date: string };

    if (!user_id || !date) {
      return json({ success: false, error: 'Missing user_id or date' }, 400);
    }

    // === Fetch ALL active google connections for this user ===
    // MULTI-CAL (ADR D4): free/busy reads EVERY active google connection, IGNORING
    // sync_booking — availability must reflect conflicts on OFF calendars too.
    const { data: connections } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .eq('provider', 'google');

    // No connection → graceful empty response
    if (!connections || connections.length === 0) {
      return json({ busy: [] });
    }

    const dayStart = `${date}T00:00:00Z`;
    const dayEnd = `${date}T23:59:59Z`;

    // Busy intervals (UTC ISO) for one connection; refresh token by `id` if expired.
    const busyForConnection = async (connection: any): Promise<Array<{ start: string; end: string }>> => {
      let accessToken = connection.google_access_token;
      const expiresAt = connection.google_token_expires_at
        ? new Date(connection.google_token_expires_at)
        : null;
      const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

      if (isExpired && clientId && clientSecret) {
        const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: connection.google_refresh_token,
            grant_type: 'refresh_token',
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.access_token) {
          accessToken = refreshData.access_token;
          const newExpiry = refreshData.expires_in
            ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
            : null;
          // INVARIANT (MULTI-CAL): refresh por `id` da row — nunca por user_id (clobber siblings).
          await supabase
            .from('user_calendar_connections')
            .update({ google_access_token: accessToken, google_token_expires_at: newExpiry, updated_at: new Date().toISOString() })
            .eq('id', connection.id);
        } else {
          console.warn('Token refresh failed for connection', connection.id, refreshData?.error);
          return [];
        }
      }

      const calendarId = connection.google_calendar_id || 'primary';
      const freeBusyRes = await fetch(FREEBUSY_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeMin: dayStart, timeMax: dayEnd, items: [{ id: calendarId }] }),
      });
      if (!freeBusyRes.ok) {
        console.warn('FreeBusy API error for connection', connection.id, freeBusyRes.status);
        return [];
      }
      const freeBusyData = await freeBusyRes.json();
      return freeBusyData.calendars?.[calendarId]?.busy ?? [];
    };

    const perConn = await Promise.all(
      connections.map((c) => busyForConnection(c).catch(() => [])),
    );
    const busySlots = perConn.flat();

    // Convert UTC ISO times to HH:MM:SS strings (in user's local context — use time portion)
    const busy = busySlots.map((slot) => ({
      start: new Date(slot.start).toISOString().split('T')[1].substring(0, 8),
      end: new Date(slot.end).toISOString().split('T')[1].substring(0, 8),
    }));

    console.log(`✅ google-cal-availability: ${busy.length} busy slots for user ${user_id} on ${date} across ${connections.length} connection(s)`);
    return json({ busy });

  } catch (err) {
    console.error('Unexpected error:', err);
    // Graceful degradation — don't fail scheduling
    return json({ busy: [] });
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
