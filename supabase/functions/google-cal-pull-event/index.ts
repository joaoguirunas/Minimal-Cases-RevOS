/**
 * Schedule PRO™ — Google Calendar Pull Event
 *
 * POST /google-cal-pull-event
 * Body: { meeting_id: string }
 *
 * Fetches the current state of a Google Calendar event and syncs it back
 * to the meetings table (title, start_time, end_time, location, meeting_link).
 * This is the reverse direction: Google Calendar → app.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json(null, 200);

  const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? '';
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
    if (authError || !user) return json({ success: false, error: 'Invalid token' }, 401);

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

    // === Parse body ===
    const { meeting_id } = await req.json() as { meeting_id: string };
    if (!meeting_id) return json({ success: false, error: 'Missing meeting_id' }, 400);

    // === Fetch meeting ===
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, google_event_id, user_id')
      .eq('id', meeting_id)
      .single();

    if (meetingError || !meeting) {
      return json({ success: false, error: 'meeting_not_found' }, 404);
    }
    if (!meeting.google_event_id) {
      return json({ success: true, skipped: true, reason: 'no_google_event_id' });
    }
    if (!meeting.user_id) {
      return json({ success: true, skipped: true, reason: 'no_consultor' });
    }

    // === Fetch calendar connection (primary = oldest google connection — ADR D5) ===
    // INVARIANT (MULTI-CAL): a user may have N connections; pull reads the primary
    // (the row that owns meetings.google_event_id). maybeSingle avoids PGRST116.
    const { data: connection } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('user_id', meeting.user_id)
      .eq('is_active', true)
      .eq('provider', 'google')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!connection?.google_access_token) {
      return json({ success: true, skipped: true, reason: 'no_calendar_connection' });
    }

    // === Refresh token if needed ===
    let accessToken = connection.google_access_token;
    const expiresAt  = connection.google_token_expires_at
      ? new Date(connection.google_token_expires_at)
      : null;
    const isExpired  = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

    if (isExpired && clientId && clientSecret) {
      const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     clientId,
          client_secret: clientSecret,
          refresh_token: connection.google_refresh_token,
          grant_type:    'refresh_token',
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.access_token) {
        accessToken = refreshData.access_token;
        const newExpiry = refreshData.expires_in
          ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
          : null;
        // INVARIANT (MULTI-CAL): refresh by PK `id`, never `user_id` — that would
        // clobber sibling connections of the same user.
        await supabase
          .from('user_calendar_connections')
          .update({ google_access_token: accessToken, google_token_expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq('id', connection.id);
      } else {
        console.warn('Token refresh failed:', refreshData);
        return json({ success: true, skipped: true, reason: 'token_refresh_failed' });
      }
    }

    // === GET event from Google Calendar ===
    const calendarId = connection.google_calendar_id || 'primary';
    const eventRes = await fetch(
      `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events/${meeting.google_event_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!eventRes.ok) {
      const errBody = await eventRes.json().catch(() => ({}));
      console.warn('GET event failed:', eventRes.status, errBody);
      if (eventRes.status === 404) {
        return json({ success: true, skipped: true, reason: 'event_not_found_on_google' });
      }
      return json({ success: false, error: 'google_api_error' }, 502);
    }

    const gcEvent = await eventRes.json();

    // === Map Google event fields to meetings columns ===
    const updates: Record<string, unknown> = {};

    if (gcEvent.summary) {
      updates.title = gcEvent.summary;
    }

    // start / end — prefer dateTime over date (all-day events)
    const startDt = gcEvent.start?.dateTime ?? (gcEvent.start?.date ? `${gcEvent.start.date}T00:00:00` : null);
    const endDt   = gcEvent.end?.dateTime   ?? (gcEvent.end?.date   ? `${gcEvent.end.date}T23:59:59`   : null);
    if (startDt) updates.start_time = startDt;
    if (endDt)   updates.end_time   = endDt;

    if (gcEvent.location !== undefined) {
      updates.location = gcEvent.location || null;
    }

    // Extract Meet link from conferenceData
    const meetLink: string | null =
      gcEvent.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri?: string }) => ep.entryPointType === 'video')?.uri
      ?? gcEvent.hangoutLink
      ?? null;
    if (meetLink) updates.meeting_link = meetLink;

    if (Object.keys(updates).length === 0) {
      return json({ success: true, skipped: true, reason: 'no_changes' });
    }

    const { error: updateError } = await supabase
      .from('meetings')
      .update(updates)
      .eq('id', meeting_id);

    if (updateError) {
      console.error('DB update error:', updateError);
      return json({ success: false, error: updateError.message }, 500);
    }

    console.log(`✅ google-cal-pull-event: synced ${meeting.google_event_id} → meeting ${meeting_id}`, updates);
    return json({ success: true, updated: updates });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ success: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
