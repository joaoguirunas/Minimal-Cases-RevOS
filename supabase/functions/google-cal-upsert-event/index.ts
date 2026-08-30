/**
 * Schedule PRO™ — Google Calendar Event Upsert
 *
 * POST /google-cal-upsert-event
 * Body: { meeting_id: string, action: 'create' | 'update' | 'delete' }
 *
 * Creates/updates/deletes the corresponding event in the consultant's Google Calendar(s).
 *
 * MULTI-CAL: a consultant may have several google connections. We sync the meeting
 * to EVERY google connection with sync_booking=true.
 *   - The PRIMARY connection (oldest row) owns meetings.google_event_id / meeting_link,
 *     so create/update/delete are authoritative against it.
 *   - Secondary connections are best-effort: events are created/patched there too, but
 *     their event ids are not persisted (the meetings table tracks a single id). On
 *     update without a stored secondary id we recreate; on delete we cannot target the
 *     secondary copy and skip it. Acceptable until a per-connection event map exists.
 *
 * INVARIANT (MULTI-CAL): each connection is a row keyed by `id`. Token refresh MUST
 * filter `.eq('id', row.id)` — never `.eq('user_id', x)` (would clobber sibling rows).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';

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

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;
    if (!isServiceRole) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return json({ success: false, error: 'Invalid token' }, 401);
      }
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
    if (!clientId || !clientSecret) {
      console.warn('[GCal] No OAuth credentials found in settings, bi_settings or env vars — sync will fail on token refresh');
    }

    // === PARSE BODY ===
    const body = await req.json();
    const { meeting_id, action } = body as { meeting_id: string; action: 'create' | 'update' | 'delete' };

    if (!meeting_id || !action) {
      return json({ success: false, error: 'Missing meeting_id or action' }, 400);
    }

    // === Fetch meeting ===
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id, start_time, end_time, location, notes, meeting_link, status, title, google_event_id,
        user_id, people_id,
        leads (
          id, title,
          clients_people ( id, name, email )
        ),
        clients_people ( id, name, email )
      `)
      .eq('id', meeting_id)
      .single();

    if (meetingError || !meeting) {
      console.warn('Meeting not found:', meeting_id);
      return json({ success: true, skipped: true, reason: 'meeting_not_found' });
    }

    const consultorId = meeting.user_id;
    if (!consultorId) {
      return json({ success: true, skipped: true, reason: 'no_consultant' });
    }

    // === Fetch ALL google connections for consultant that sync bookings ===
    // Ordered by created_at so the oldest row is the PRIMARY (owns meetings.google_event_id).
    const { data: connections } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('user_id', consultorId)
      .eq('is_active', true)
      .eq('provider', 'google')
      .eq('sync_booking', true)
      .order('created_at', { ascending: true });

    if (!connections || connections.length === 0) {
      return json({ success: true, skipped: true, reason: 'no_calendar_connection' });
    }

    // === Build event payload (shared across calendars) ===
    // Try lead → person chain first, then direct people_id (manual meetings)
    const personViaLead = (meeting.leads as any)?.clients_people;
    const personDirect = (meeting as any).clients_people;
    const clientName = personViaLead?.name ?? personDirect?.name ?? 'Cliente';
    const clientEmail = personViaLead?.email ?? personDirect?.email ?? null;

    const eventPayload: Record<string, unknown> = {
      summary: `Reunião — ${clientName}`,
      description: meeting.notes
        ? `${meeting.notes}\n\nAgendado via app.`
        : 'Agendado via app.',
      start: { dateTime: meeting.start_time, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: meeting.end_time, timeZone: 'America/Sao_Paulo' },
    };
    if (meeting.location) {
      eventPayload.location = meeting.location;
    }
    if (meeting.meeting_link) {
      eventPayload.description = `${eventPayload.description}\n\nLink: ${meeting.meeting_link}`;
    }

    // Refresh the access token for a single connection row, persisting by `id`.
    // Returns the usable access token, or null if refresh failed.
    async function tokenFor(connection: any): Promise<string | null> {
      let accessToken = connection.google_access_token;
      const expiresAt = connection.google_token_expires_at
        ? new Date(connection.google_token_expires_at)
        : null;
      const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;
      if (!isExpired) return accessToken;
      if (!clientId || !clientSecret) return accessToken;

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
        await supabase
          .from('user_calendar_connections')
          .update({ google_access_token: accessToken, google_token_expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq('id', connection.id);
        return accessToken;
      }
      console.error('[GCal] Token refresh failed:', JSON.stringify(refreshData));
      console.error('[GCal] Check bi_settings: client_id and client_secret must match the Google Cloud OAuth credential.');
      return null;
    }

    // Create an event with a Google Meet link; returns { google_event_id, meet_link } or null.
    async function createEvent(
      accessToken: string,
      baseUrl: string,
      attendees: Array<{ email: string }>,
    ): Promise<{ google_event_id: string; meet_link: string | null } | null> {
      const payloadWithConference = {
        ...eventPayload,
        attendees,
        conferenceData: {
          createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
        },
      };
      const createRes = await fetch(`${baseUrl}?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadWithConference),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.id) {
        console.warn('Create event failed:', createRes.status, createData?.error?.message);
        return null;
      }
      const meetLink: string | null =
        createData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ?? null;
      return { google_event_id: createData.id, meet_link: meetLink };
    }

    const primary = connections[0];
    const secondaries = connections.slice(1);

    // === DELETE ===
    if (action === 'delete') {
      const googleEventId = meeting.google_event_id;
      if (!googleEventId) {
        return json({ success: true, skipped: true, reason: 'no_google_event_id' });
      }
      // Only the primary connection's event id is tracked; delete there.
      // Secondary copies cannot be targeted without a per-connection event map.
      const accessToken = await tokenFor(primary);
      if (accessToken) {
        const calendarId = primary.google_calendar_id || 'primary';
        const baseUrl = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events`;
        const deleteRes = await fetch(`${baseUrl}/${googleEventId}?sendUpdates=all`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!deleteRes.ok && deleteRes.status !== 404) {
          console.warn('Delete event failed:', deleteRes.status);
        }
      }
      return json({ success: true, action: 'deleted' });
    }

    // === CREATE ===
    if (action === 'create') {
      // Primary: authoritative — persists google_event_id + meeting_link.
      const primaryToken = await tokenFor(primary);
      if (!primaryToken) {
        return json({ success: true, skipped: true, reason: 'token_refresh_failed' });
      }
      const primaryCalId = primary.google_calendar_id || 'primary';
      const primaryBase = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(primaryCalId)}/events`;
      const primaryAttendees: Array<{ email: string }> = [{ email: primary.google_email }];
      if (clientEmail) primaryAttendees.push({ email: clientEmail });

      const created = await createEvent(primaryToken, primaryBase, primaryAttendees);
      if (!created) {
        return json({ success: true, skipped: true, reason: 'create_failed' });
      }
      await supabase
        .from('meetings')
        .update({
          google_event_id: created.google_event_id,
          ...(created.meet_link ? { meeting_link: created.meet_link } : {}),
        })
        .eq('id', meeting_id);

      // Secondaries: best-effort, event ids not tracked.
      let secondaryCount = 0;
      for (const conn of secondaries) {
        const tok = await tokenFor(conn);
        if (!tok) continue;
        const calId = conn.google_calendar_id || 'primary';
        const base = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calId)}/events`;
        const att: Array<{ email: string }> = [{ email: conn.google_email }];
        if (clientEmail) att.push({ email: clientEmail });
        const r = await createEvent(tok, base, att);
        if (r) secondaryCount++;
      }

      console.log(`✅ google-cal-upsert-event: created ${created.google_event_id} for meeting ${meeting_id} (primary + ${secondaryCount}/${secondaries.length} secondary)`);
      return json({ success: true, action: 'created', google_event_id: created.google_event_id, meet_link: created.meet_link, secondary_synced: secondaryCount });
    }

    // === UPDATE ===
    if (action === 'update') {
      const primaryToken = await tokenFor(primary);
      if (!primaryToken) {
        return json({ success: true, skipped: true, reason: 'token_refresh_failed' });
      }
      const primaryCalId = primary.google_calendar_id || 'primary';
      const primaryBase = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(primaryCalId)}/events`;
      const primaryAttendees: Array<{ email: string }> = [{ email: primary.google_email }];
      if (clientEmail) primaryAttendees.push({ email: clientEmail });

      const googleEventId = meeting.google_event_id;
      if (!googleEventId) {
        // No tracked event yet — create on the primary.
        const created = await createEvent(primaryToken, primaryBase, primaryAttendees);
        if (!created) {
          return json({ success: true, skipped: true, reason: 'create_on_update_failed' });
        }
        await supabase
          .from('meetings')
          .update({
            google_event_id: created.google_event_id,
            ...(created.meet_link ? { meeting_link: created.meet_link } : {}),
          })
          .eq('id', meeting_id);
        return json({ success: true, action: 'created_on_update', google_event_id: created.google_event_id, meet_link: created.meet_link });
      }

      const patchRes = await fetch(`${primaryBase}/${googleEventId}?sendUpdates=all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventPayload, attendees: primaryAttendees }),
      });
      if (!patchRes.ok) {
        console.warn('Patch event failed:', patchRes.status);
        return json({ success: true, skipped: true, reason: 'patch_failed' });
      }
      console.log(`✅ google-cal-upsert-event: updated ${googleEventId} for meeting ${meeting_id} (primary; ${secondaries.length} secondary not tracked)`);
      return json({ success: true, action: 'updated', google_event_id: googleEventId });
    }

    return json({ success: false, error: 'Unknown action' }, 400);

  } catch (err) {
    console.error('Unexpected error:', err);
    // Graceful — don't fail the caller
    return json({ success: true, skipped: true, reason: String(err) });
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
