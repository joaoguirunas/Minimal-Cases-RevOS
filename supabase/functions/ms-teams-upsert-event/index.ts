/**
 * Schedule PRO™ — Microsoft Teams Meeting Upsert
 *
 * POST /ms-teams-upsert-event
 * Body: { meeting_id: string, action: 'create' | 'update' | 'delete' }
 *
 * Flow:
 * 1. Fetch meeting + consultant from DB
 * 2. Check consultant has provider='microsoft' connection
 * 3. Refresh token if needed
 * 4. Call Microsoft Graph API /me/onlineMeetings
 * 5. Save ms_meeting_id + meeting_link (joinWebUrl) back to meetings
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MS_TOKEN_URL  = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_MEETINGS = 'https://graph.microsoft.com/v1.0/me/onlineMeetings';

type Action = 'create' | 'update' | 'delete';

interface CalendarConnection {
  provider: string;
  ms_access_token: string | null;
  ms_refresh_token: string | null;
  ms_token_expires_at: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json(null, 200);

  const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ success: false, error: 'Invalid token' }, 401);

    const { meeting_id, action } = await req.json() as { meeting_id: string; action: Action };
    if (!meeting_id || !action) return json({ success: false, error: 'Missing meeting_id or action' }, 400);

    // === Fetch meeting ===
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id, start_time, end_time, location, notes, meeting_link,
        status, title, ms_meeting_id, user_id,
        leads (id, title, clients_people (id, name, email))
      `)
      .eq('id', meeting_id)
      .single();

    if (meetingError || !meeting) {
      return json({ success: true, skipped: true, reason: 'meeting_not_found' });
    }

    if (!meeting.user_id) {
      return json({ success: true, skipped: true, reason: 'no_consultor' });
    }

    // === Check Microsoft calendar connection ===
    const { data: connection } = await supabase
      .from('user_calendar_connections')
      .select('provider, ms_access_token, ms_refresh_token, ms_token_expires_at')
      .eq('user_id', meeting.user_id)
      .eq('is_active', true)
      .maybeSingle() as { data: CalendarConnection | null };

    if (!connection || connection.provider !== 'microsoft' || !connection.ms_access_token) {
      return json({ success: true, skipped: true, reason: 'no_ms_connection' });
    }

    // === Azure credentials ===
    const { data: settings } = await supabase
      .from('bi_settings')
      .select('ms_client_id, ms_client_secret')
      .limit(1)
      .maybeSingle();
    const clientId     = settings?.ms_client_id     ?? Deno.env.get('MS_CLIENT_ID') ?? '';
    const clientSecret = settings?.ms_client_secret ?? Deno.env.get('MS_CLIENT_SECRET') ?? '';

    // === Token refresh if needed ===
    let accessToken = connection.ms_access_token;
    const expiresAt = connection.ms_token_expires_at
      ? new Date(connection.ms_token_expires_at).getTime()
      : 0;
    const needsRefresh = !expiresAt || Date.now() > expiresAt - 60_000;

    if (needsRefresh && connection.ms_refresh_token && clientId && clientSecret) {
      const refreshRes = await fetch(MS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: connection.ms_refresh_token,
          client_id:     clientId,
          client_secret: clientSecret,
          scope:         'OnlineMeetings.ReadWrite offline_access User.Read',
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
          .update({
            ms_access_token:     accessToken,
            ms_token_expires_at: newExpiry,
            ...(refreshData.refresh_token ? { ms_refresh_token: refreshData.refresh_token } : {}),
          })
          .eq('user_id', meeting.user_id);
      } else {
        console.error('MS token refresh failed:', refreshData);
        return json({ success: true, skipped: true, reason: 'token_refresh_failed' });
      }
    }

    // === GRAPH API calls ===
    const authHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    };

    // ── DELETE ──────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!meeting.ms_meeting_id) return json({ success: true, skipped: true, reason: 'no_ms_meeting_id' });
      const delRes = await fetch(`${GRAPH_MEETINGS}/${meeting.ms_meeting_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!delRes.ok && delRes.status !== 404) {
        const errBody = await delRes.text();
        console.error('MS delete error:', delRes.status, errBody);
      }
      return json({ success: true, action: 'deleted' });
    }

    // ── BUILD EVENT PAYLOAD ──────────────────────────────────────────────
    const clientName = (meeting.leads as { clients_people?: { name?: string } } | null)
      ?.clients_people?.name ?? '';
    const clientEmail = (meeting.leads as { clients_people?: { email?: string } } | null)
      ?.clients_people?.email ?? '';

    const subject = meeting.title || (clientName ? `Reunião — ${clientName}` : 'Reunião');
    const body    = [
      meeting.notes || '',
      '',
      'Agendado via app.',
    ].filter(Boolean).join('\n');

    const payload = {
      subject,
      body: { contentType: 'text', content: body },
      startDateTime: meeting.start_time,
      endDateTime:   meeting.end_time,
      ...(meeting.location ? { location: { displayName: meeting.location } } : {}),
      ...(clientEmail ? {
        participants: {
          attendees: [{ upn: clientEmail, role: 'attendee' }],
        },
      } : {}),
    };

    // ── CREATE ──────────────────────────────────────────────────────────
    if (action === 'create') {
      const createRes = await fetch(GRAPH_MEETINGS, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const created = await createRes.json();

      if (!createRes.ok) {
        console.error('MS create error:', createRes.status, created);
        return json({ success: false, error: created.error?.message ?? 'Failed to create Teams meeting' }, 502);
      }

      const msMeetingId: string = created.id ?? '';
      const joinWebUrl:  string = created.joinWebUrl ?? '';

      // Update meetings with Teams meeting ID + join link
      if (msMeetingId) {
        await supabase
          .from('meetings')
          .update({
            ms_meeting_id: msMeetingId,
            meeting_link:  joinWebUrl || null,
          })
          .eq('id', meeting_id);
      }

      console.log(`✅ ms-teams-upsert-event: created ${msMeetingId} for meeting ${meeting_id}`);
      return json({ success: true, action: 'created', ms_meeting_id: msMeetingId, join_url: joinWebUrl });
    }

    // ── UPDATE ──────────────────────────────────────────────────────────
    if (action === 'update') {
      if (!meeting.ms_meeting_id) {
        // No Teams meeting yet — create one
        const createRes = await fetch(GRAPH_MEETINGS, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        const created = await createRes.json();
        if (!createRes.ok) {
          console.error('MS create-on-update error:', createRes.status, created);
          return json({ success: true, skipped: true, reason: 'create_failed' });
        }
        const msMeetingId: string = created.id ?? '';
        const joinWebUrl:  string = created.joinWebUrl ?? '';
        if (msMeetingId) {
          await supabase
            .from('meetings')
            .update({ ms_meeting_id: msMeetingId, meeting_link: joinWebUrl || null })
            .eq('id', meeting_id);
        }
        return json({ success: true, action: 'created', ms_meeting_id: msMeetingId, join_url: joinWebUrl });
      }

      const updateRes = await fetch(`${GRAPH_MEETINGS}/${meeting.ms_meeting_id}`, {
        method:  'PATCH',
        headers: authHeaders,
        body:    JSON.stringify(payload),
      });

      if (!updateRes.ok && updateRes.status !== 204) {
        const errBody = await updateRes.text();
        console.error('MS update error:', updateRes.status, errBody);
        return json({ success: true, skipped: true, reason: 'update_failed' });
      }

      return json({ success: true, action: 'updated', ms_meeting_id: meeting.ms_meeting_id });
    }

    return json({ success: false, error: 'Unknown action' }, 400);

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
