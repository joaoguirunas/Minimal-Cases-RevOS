/**
 * Schedule PRO™ — Google Calendar Sync External Events
 *
 * POST /google-cal-sync-events
 * Body: { user_ids: string[], date_start: string, date_end: string }
 *       OR legacy: { user_id: string, date_start: string, date_end: string }
 *
 * Returns: { events: [{ id, title, start, end, calendar_source, user_id, html_link }], connected, error }
 * Events already tracked in meetings table (by google_event_id) are excluded.
 * Events are attributed to their originating user via user_id field.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(null, 200);
  }

  const supabaseUrl       = Deno.env.get('SUPABASE_URL') ?? '';
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

    // === PARSE BODY — support user_ids[] or legacy user_id ===
    const body = await req.json() as {
      user_id?: string;
      user_ids?: string[];
      date_start: string;
      date_end: string;
    };

    const targetUserIds: string[] =
      body.user_ids?.length
        ? body.user_ids
        : body.user_id
          ? [body.user_id]
          : [];

    const { date_start, date_end } = body;

    if (targetUserIds.length === 0 || !date_start || !date_end) {
      return json({ success: false, error: 'Missing user_id(s), date_start, or date_end' }, 400);
    }

    // === Fetch all active google calendar connections for requested users ===
    // MULTI-CAL: a user may have multiple google rows — each is processed independently.
    const { data: connections } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .in('user_id', targetUserIds)
      .eq('is_active', true)
      .eq('provider', 'google');

    if (!connections || connections.length === 0) {
      return json({ events: [], connected: false, error: 'not_connected' });
    }

    // === Fetch google_event_ids of CRM meetings (with lead) already tracked ===
    // Only exclude events that have a lead_id (real CRM meetings).
    // Personal Google events (no lead_id) remain as external overlay events.
    const { data: syncedMeetings } = await supabase
      .from('meetings')
      .select('google_event_id')
      .in('user_id', targetUserIds)
      .not('google_event_id', 'is', null)
      .not('lead_id', 'is', null);

    const syncedIds = new Set(
      (syncedMeetings ?? []).map((m: any) => m.google_event_id).filter(Boolean)
    );

    const timeMin = `${date_start}T00:00:00Z`;
    const timeMax = `${date_end}T23:59:59Z`;

    // === Process each user's calendar in parallel ===
    const processConnection = async (connection: any): Promise<any[]> => {
      let accessToken = connection.google_access_token;
      const expiresAt  = connection.google_token_expires_at
        ? new Date(connection.google_token_expires_at)
        : null;
      const isExpired  = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

      // Refresh token if expired
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
            .update({
              google_access_token: accessToken,
              google_token_expires_at: newExpiry,
              updated_at: new Date().toISOString(),
            })
            .eq('id', connection.id);
        } else {
          console.warn(`Token refresh failed for user ${connection.user_id}:`, refreshData);
          return [];
        }
      }

      // Fetch events from Google Calendar
      const calendarId = connection.google_calendar_id || 'primary';
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });

      const eventsRes = await fetch(
        `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!eventsRes.ok) {
        const errBody = await eventsRes.json().catch(() => ({}));
        const errMsg = (errBody as any)?.error?.message ?? '';
        console.warn(
          `events.list failed for user ${connection.user_id}:`,
          eventsRes.status,
          errMsg
        );
        // Return a special sentinel so we can surface the right error to the UI
        if (eventsRes.status === 403) {
          return [{ __error: 'api_disabled' }];
        }
        return [{ __error: 'api_error' }];
      }

      const eventsData = await eventsRes.json();
      const rawEvents: any[] = eventsData.items ?? [];

      // Filter out events already synced from the app and cancelled events
      return rawEvents
        .filter((e: any) => !syncedIds.has(e.id) && e.status !== 'cancelled')
        .map((e: any) => ({
          // Namespace id by user to avoid React key collisions across calendars
          id: `${connection.user_id}::${e.id}`,
          title: e.summary ?? '(Sem título)',
          start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
          end: e.end?.dateTime ?? `${e.end?.date}T23:59:59`,
          calendar_source: 'google' as const,
          html_link: e.htmlLink ?? null,
          user_id: connection.user_id,
        }));
    };

    const results   = await Promise.all(connections.map(processConnection));
    const flat      = results.flat();

    // Check for error sentinels from processConnection
    const apiDisabled = flat.some((e: any) => e.__error === 'api_disabled');
    const apiError    = flat.some((e: any) => e.__error === 'api_error');
    const allEvents   = flat.filter((e: any) => !e.__error);

    if (apiDisabled) {
      console.warn('google-cal-sync-events: Google Calendar API not enabled (403)');
      return json({ events: [], connected: true, error: 'api_disabled' });
    }
    if (apiError) {
      console.warn('google-cal-sync-events: Google Calendar API error');
      return json({ events: [], connected: true, error: 'api_error' });
    }

    console.log(
      `✅ google-cal-sync-events: ${allEvents.length} external events` +
      ` for ${connections.length}/${targetUserIds.length} connected user(s)`
    );

    return json({ events: allEvents, connected: true, error: null });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ events: [], connected: false, error: 'api_error' });
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
