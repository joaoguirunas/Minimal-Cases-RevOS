/**
 * Schedule PRO™ — Google Calendar → DB Sync (Cron)
 *
 * Called every 15 minutes by pg_cron (or manually).
 * Fetches all active Google Calendar connections and upserts events
 * into the meetings table covering: 7 days back → 60 days forward.
 *
 * Strategy:
 * - New Google events  → INSERT with source='google', status='agendado'
 * - Existing events    → UPDATE title/time/location/notes only
 *                        (preserves status like 'compareceu', lead_id, etc.)
 * - Cancelled events   → UPDATE status='cancelado'
 * - Auth               → Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const SYNC_DAYS_AHEAD     = 60;
const SYNC_DAYS_BACK      = 7;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Auth: accept service_role key (pg_cron) OR valid user JWT (manual trigger from UI)
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  // If not the service role key, validate as user JWT
  if (token !== serviceRoleKey) {
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: authErr } = await anonClient.auth.getUser();
    if (authErr) return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
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
      return json({ synced: 0, users: 0, message: 'Google credentials not configured' });
    }

    // === Fetch all active google connections (IMPORT path — reads all, ignores sync_booking) ===
    // MULTI-CAL: provider filter avoids treating MS/zoom rows as google.
    const { data: connections, error: connErr } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('is_active', true)
      .eq('provider', 'google');

    if (connErr || !connections || connections.length === 0) {
      return json({ synced: 0, deleted: 0, users: 0, message: 'No active connections' });
    }

    // Date range
    const now     = new Date();
    const timeMin = new Date(now); timeMin.setDate(timeMin.getDate() - SYNC_DAYS_BACK);
    const timeMax = new Date(now); timeMax.setDate(timeMax.getDate() + SYNC_DAYS_AHEAD);

    // === Process all users in parallel ===
    const results = await Promise.all(
      connections.map(conn =>
        syncUserCalendar(supabase, conn, clientId, clientSecret, timeMin.toISOString(), timeMax.toISOString())
      )
    );

    const totalSynced  = results.reduce((s, r) => s + r.synced,  0);
    const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
    const totalErrors  = results.reduce((s, r) => s + r.errors,  0);
    const allErrorDetails = results.flatMap(r => r.errorDetails ?? []);

    console.log(
      `✅ google-cal-sync-to-db: ${totalSynced} upserted, ${totalDeleted} cancelled,` +
      ` ${totalErrors} errors — ${connections.length} user(s)`
    );

    return json({ synced: totalSynced, deleted: totalDeleted, errors: totalErrors, users: connections.length, error_details: allErrorDetails });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: String(err) }, 500);
  }
});

// ─── Per-user sync ────────────────────────────────────────────────────────────

async function syncUserCalendar(
  supabase: ReturnType<typeof createClient>,
  connection: Record<string, any>,
  clientId: string,
  clientSecret: string,
  timeMin: string,
  timeMax: string
): Promise<{ synced: number; deleted: number; errors: number }> {
  try {
    // 1. Refresh access token if expired
    let accessToken = connection.google_access_token;
    const expiresAt = connection.google_token_expires_at ? new Date(connection.google_token_expires_at) : null;
    const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

    if (isExpired) {
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
      if (!refreshRes.ok || !refreshData.access_token) {
        console.warn(`Token refresh failed for user ${connection.user_id}:`, refreshData);
        return { synced: 0, deleted: 0, errors: 1 };
      }
      accessToken = refreshData.access_token;
      const newExpiry = refreshData.expires_in
        ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        : null;
      // INVARIANT (MULTI-CAL): refresh por `id` da row — nunca por user_id (clobber siblings).
      await supabase.from('user_calendar_connections').update({
        google_access_token: accessToken,
        google_token_expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);
    }

    // 2. Fetch events from Google Calendar
    const calendarId = connection.google_calendar_id || 'primary';
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',  // expands recurring → individual instances
      showDeleted:  'true',  // inclui eventos deletados com status='cancelled'
      orderBy: 'startTime',
      maxResults: '500',
    });

    const eventsRes = await fetch(
      `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!eventsRes.ok) {
      const errBody = await eventsRes.json().catch(() => ({}));
      console.warn(
        `events.list failed for user ${connection.user_id}:`,
        eventsRes.status,
        (errBody as any)?.error?.message
      );
      return { synced: 0, deleted: 0, errors: 1 };
    }

    const eventsData   = await eventsRes.json();
    const rawEvents: any[] = eventsData.items ?? [];

    const activeEvents    = rawEvents.filter(e => e.status !== 'cancelled');
    const cancelledIds    = rawEvents.filter(e => e.status === 'cancelled').map(e => e.id);
    const nowISO          = new Date().toISOString();

    let synced  = 0;
    let deleted = 0;
    let errors  = 0;
    const errorDetails: string[] = [];

    // 3. Sync active events
    if (activeEvents.length > 0) {
      const googleIds = activeEvents.map(e => e.id);

      // Find which events already exist in meetings
      const { data: existing } = await supabase
        .from('meetings')
        .select('id, google_event_id')
        .in('google_event_id', googleIds);

      const existingMap = new Map((existing ?? []).map((r: any) => [r.google_event_id, r.id]));

      const toInsert: any[] = [];
      const toUpdate: { meetingId: string; fields: Record<string, any> }[] = [];

      // Build set of internal user emails to exclude from people_id matching.
      // Internal users (settings_users) are consultants — never clients — regardless
      // of which calendar the event came from.
      const { data: internalUsers } = await supabase
        .from('settings_users')
        .select('email');
      const internalEmails = new Set(
        (internalUsers ?? []).map((u: any) => (u.email ?? '').toLowerCase()).filter(Boolean)
      );

      // Collect attendee emails from NEW events to resolve people_id
      const attendeeEmails = new Set<string>();
      for (const e of activeEvents) {
        if (!existingMap.has(e.id) && Array.isArray(e.attendees)) {
          for (const att of e.attendees) {
            const email = att.email?.toLowerCase();
            if (email && !internalEmails.has(email)) {
              attendeeEmails.add(email);
            }
          }
        }
      }

      // Batch lookup: match attendee emails to existing contacts
      let emailToPeopleId = new Map<string, string>();
      if (attendeeEmails.size > 0) {
        const { data: matchedPeople } = await supabase
          .from('clients_people')
          .select('id, email')
          .in('email', [...attendeeEmails]);
        if (matchedPeople) {
          for (const p of matchedPeople) {
            if (p.email) emailToPeopleId.set(p.email.toLowerCase(), p.id);
          }
        }
      }

      for (const e of activeEvents) {
        const startDT = e.start?.dateTime ?? `${e.start?.date}T00:00:00`;
        const endDT   = e.end?.dateTime   ?? `${e.end?.date}T23:59:59`;

        const meetLink: string | null =
          e.hangoutLink ??
          e.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ??
          null;

        // Collect attendee emails for persistence
        const eventAttendeeEmails: string[] = Array.isArray(e.attendees)
          ? e.attendees
              .map((att: any) => att.email?.toLowerCase())
              .filter((email: string | undefined): email is string =>
                !!email && !email.endsWith('@group.calendar.google.com')
              )
          : [];

        const metaFields = {
          title:               e.summary  ?? '(Sem título)',
          start_time:          startDT,
          end_time:            endDT,
          location:            e.location    ?? null,
          notes:               e.description ?? null,
          meeting_link:        meetLink,
          attendee_emails:     eventAttendeeEmails,
          google_last_synced_at: nowISO,
        };

        const existingId = existingMap.get(e.id);
        if (existingId) {
          toUpdate.push({ meetingId: existingId, fields: metaFields });
        } else {
          // Resolve people_id from attendee emails (first match wins)
          let peopleId: string | null = null;
          if (Array.isArray(e.attendees)) {
            for (const att of e.attendees) {
              if (att.email) {
                const matched = emailToPeopleId.get(att.email.toLowerCase());
                if (matched) { peopleId = matched; break; }
              }
            }
          }

          toInsert.push({
            ...metaFields,
            status:          'agendado',
            source:          'google',
            user_id:        connection.user_id,
            google_event_id: e.id,
            ...(peopleId ? { people_id: peopleId } : {}),
          });
        }
      }

      // Batch insert new events
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('meetings').insert(toInsert);
        if (insErr) {
          const msg = `INSERT failed: ${insErr.message} (code: ${insErr.code})`;
          console.error(`[sync] user ${connection.user_id}: ${msg}`);
          errorDetails.push(msg);
          errors++;
        } else {
          synced += toInsert.length;
        }
      }

      // Update existing events individually
      if (toUpdate.length > 0) {
        const updateResults = await Promise.all(
          toUpdate.map(({ meetingId, fields }) =>
            supabase.from('meetings').update(fields).eq('id', meetingId)
          )
        );
        for (const r of updateResults) {
          if (r.error) {
            const msg = `UPDATE failed: ${r.error.message} (code: ${r.error.code})`;
            console.error(`[sync] user ${connection.user_id}: ${msg}`);
            errorDetails.push(msg);
            errors++;
          } else {
            synced++;
          }
        }
      }
    }

    // 4. Mark cancelled events as 'cancelado'
    if (cancelledIds.length > 0) {
      const { error: cancelErr } = await supabase
        .from('meetings')
        .update({ status: 'cancelado', google_last_synced_at: nowISO })
        .in('google_event_id', cancelledIds)
        .eq('user_id', connection.user_id);

      if (cancelErr) {
        const msg = `CANCEL failed: ${cancelErr.message}`;
        console.error(`[sync] user ${connection.user_id}: ${msg}`);
        errorDetails.push(msg);
        errors++;
      } else {
        deleted += cancelledIds.length;
      }
    }

    return { synced, deleted, errors, errorDetails };

  } catch (err) {
    console.warn(`Error syncing user ${connection.user_id}:`, err);
    return { synced: 0, deleted: 0, errors: 1 };
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
