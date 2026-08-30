/**
 * Schedule PRO™ — Zoom Meeting Upsert
 *
 * POST /zoom-upsert-event
 * Body: { meeting_id: string, action: 'create' | 'update' | 'delete' }
 *
 * Creates, updates or deletes the Zoom meeting linked to a RevOS meeting.
 * Silently skips if the consultant has no Zoom connection.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ZOOM_TOKEN_URL    = 'https://zoom.us/oauth/token';
const ZOOM_MEETINGS_URL = 'https://api.zoom.us/v2/users/me/meetings';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

async function refreshZoomToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const res = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const data = await res.json() as Record<string, string | number>;
  if (!res.ok || !data.access_token) {
    console.error('[zoom-upsert-event] token refresh failed:', data);
    return null;
  }
  const expiresAt = new Date(Date.now() + ((data.expires_in as number) || 3600) * 1000).toISOString();
  await supabase
    .from('user_calendar_connections')
    .update({ zoom_access_token: data.access_token, zoom_token_expires_at: expiresAt })
    .eq('user_id', userId);
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ success: false, error: 'Invalid token' }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === Parse body ===
    const body = await req.json() as { meeting_id?: string; action?: 'create' | 'update' | 'delete' };
    const { meeting_id, action } = body;
    if (!meeting_id || !action) return json({ success: false, error: 'Missing meeting_id or action' }, 400);

    // === Fetch meeting ===
    const { data: meeting, error: meetErr } = await supabase
      .from('meetings')
      .select(`
        id, start_time, end_time, title, notes, zoom_meeting_id,
        user_id,
        leads ( id, clients_people ( id, name, email ) ),
        clients_people ( id, name, email )
      `)
      .eq('id', meeting_id)
      .single();

    if (meetErr || !meeting) return json({ success: true, skipped: true, reason: 'meeting_not_found' });

    const consultorId = meeting.user_id as string | null;
    if (!consultorId) return json({ success: true, skipped: true, reason: 'no_consultant' });

    // === Fetch Zoom connection ===
    const { data: connection } = await supabase
      .from('user_calendar_connections')
      .select('user_id, zoom_access_token, zoom_refresh_token, zoom_token_expires_at, zoom_user_id')
      .eq('user_id', consultorId)
      .eq('provider', 'zoom')
      .eq('is_active', true)
      .maybeSingle();

    if (!connection) return json({ success: true, skipped: true, reason: 'no_zoom_connection' });

    // === Zoom app credentials for token refresh ===
    const { data: biSettings } = await supabase
      .from('bi_settings')
      .select('zoom_client_id, zoom_client_secret')
      .limit(1)
      .maybeSingle();

    const clientId     = biSettings?.zoom_client_id     ?? Deno.env.get('ZOOM_CLIENT_ID') ?? '';
    const clientSecret = biSettings?.zoom_client_secret ?? Deno.env.get('ZOOM_CLIENT_SECRET') ?? '';

    // === Refresh token if needed ===
    let accessToken = connection.zoom_access_token as string;
    const expiresAt = connection.zoom_token_expires_at ? new Date(connection.zoom_token_expires_at as string) : null;
    const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

    if (isExpired && clientId && clientSecret) {
      const newToken = await refreshZoomToken(
        supabase, consultorId, connection.zoom_refresh_token as string, clientId, clientSecret,
      );
      if (!newToken) {
        await supabase.from('meetings').update({ zoom_sync_error: 'token_refresh_failed' }).eq('id', meeting_id);
        return json({ success: false, skipped: true, reason: 'token_refresh_failed' });
      }
      accessToken = newToken;
    }

    const zoomMeetingId = meeting.zoom_meeting_id as string | null;

    // === DELETE ===
    if (action === 'delete') {
      if (!zoomMeetingId) return json({ success: true, skipped: true, reason: 'no_zoom_meeting' });
      const delRes = await fetch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!delRes.ok && delRes.status !== 404) {
        const err = await delRes.json().catch(() => ({}));
        console.error('[zoom-upsert-event] delete failed:', err);
      }
      await supabase.from('meetings').update({ zoom_meeting_id: null, zoom_join_url: null, zoom_sync_error: null }).eq('id', meeting_id);
      return json({ success: true, action: 'deleted' });
    }

    // === CREATE or UPDATE ===
    const lead = (meeting.leads as Record<string, unknown> | null) ?? null;
    const person = (lead?.clients_people ?? meeting.clients_people) as { name?: string; email?: string } | null;
    const clientName  = person?.name  ?? 'Cliente';
    const clientEmail = person?.email ?? null;

    const startDt = new Date(meeting.start_time as string);
    const endDt   = new Date(meeting.end_time as string);
    const durationMin = Math.round((endDt.getTime() - startDt.getTime()) / 60_000);

    const zoomPayload = {
      topic:    (meeting.title as string) || `Reunião — ${clientName}`,
      type:     2, // scheduled
      start_time: startDt.toISOString(),
      duration:   durationMin,
      timezone:   'America/Sao_Paulo',
      agenda:     meeting.notes || 'Agendado via Growth Sales.',
      settings: {
        host_video:      true,
        participant_video: true,
        join_before_host: false,
        waiting_room:    true,
      },
    };

    let zoomRes: Response;
    if (action === 'update' && zoomMeetingId) {
      zoomRes = await fetch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(zoomPayload),
      });
    } else {
      zoomRes = await fetch(ZOOM_MEETINGS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(zoomPayload),
      });
    }

    if (!zoomRes.ok) {
      const errData = await zoomRes.json().catch(() => ({})) as Record<string, unknown>;
      console.error('[zoom-upsert-event] Zoom API error:', errData);
      await supabase.from('meetings').update({ zoom_sync_error: String(errData.message ?? zoomRes.status) }).eq('id', meeting_id);
      return json({ success: false, error: 'Zoom API error', detail: errData.message ?? zoomRes.status });
    }

    const zoomData = action === 'update' && zoomMeetingId
      ? { id: zoomMeetingId, join_url: null as string | null }
      : await zoomRes.json() as { id: string | number; join_url?: string };

    const newZoomId  = String(zoomData.id);
    const joinUrl    = zoomData.join_url ?? null;

    await supabase
      .from('meetings')
      .update({
        zoom_meeting_id: newZoomId,
        zoom_join_url:   joinUrl,
        zoom_sync_error: null,
        meeting_link:    joinUrl ?? (meeting as Record<string, unknown>).meeting_link ?? null,
      })
      .eq('id', meeting_id);

    return json({ success: true, action, zoom_meeting_id: newZoomId, join_url: joinUrl });

  } catch (err) {
    console.error('[zoom-upsert-event] unhandled error:', err);
    return json({ success: false, error: (err as Error)?.message ?? 'Internal server error' }, 500);
  }
});
