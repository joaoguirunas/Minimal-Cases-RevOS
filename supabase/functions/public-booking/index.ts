/**
 * Public Booking — Schedule PRO™
 *
 * Public edge function (no auth required) for client-facing booking side-effects.
 *
 * Routes (dispatched by "action" field in POST body):
 *   POST { action: "gcal_sync", meeting_id }
 *        → Pushes meeting to consultant's Google Calendar.
 *        Called after book_meeting RPC confirms a public booking.
 *
 *   POST { action: "wa_confirm", meeting_id, template_name? }
 *        → Sends WhatsApp confirmation template after booking.
 *
 * NOTE: "session" and "confirm" actions were removed — those flows are handled
 * by RPCs get_booking_session and book_meeting directly from the frontend.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { issueActionToken } from '../_shared/capability/issueAction.ts';
import { consumeActionToken } from '../_shared/capability/consumeAction.ts';

// ── In-memory rate limit (per-isolate, resets on cold start) ─────────────────
// AC10: 30 req/min per IP. Stateless edge functions — no distributed state.
const _rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX    = 30;
const RATE_WIN_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const s   = _rateMap.get(ip);
  if (!s || s.resetAt < now) { _rateMap.set(ip, { count: 1, resetAt: now + RATE_WIN_MS }); return true; }
  if (s.count >= RATE_MAX) return false;
  s.count++;
  return true;
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Rate limit — AC10
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown';
  if (!checkRateLimit(clientIp)) {
    return json({ error: 'rate_limited', retry_after: Math.ceil(RATE_WIN_MS / 1000) }, 429);
  }

  const log = createLogger('public-booking');

  try {

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  log.info('request', { action: body.action });

  const { action } = body;

  // ── ACTION: issue_tokens ──────────────────────────────────────────────────
  // Called immediately after book_meeting. Returns two short-lived single-use
  // action tokens (60s TTL) for gcal_sync and wa_confirm.
  // Guard: meeting must have been created within the last 5 minutes to prevent IDOR abuse.
  if (action === 'issue_tokens') {
    const meeting_id = body.meeting_id as string | undefined;
    if (!meeting_id) return json({ error: 'missing_meeting_id' }, 400);

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, user_id, created_at')
      .eq('id', meeting_id)
      .single();

    if (!meeting) return json({ error: 'meeting_not_found' }, 404);

    const ageMs = Date.now() - new Date(meeting.created_at).getTime();
    if (ageMs > 5 * 60 * 1000) return json({ error: 'meeting_too_old' }, 403);

    // Derive tenant_id from the consultant's auth user app_metadata (ADR-SP-01 §3).
    // meeting.user_id is a settings_users.id — look up auth_user_id, then tenant_id.
    let tenant_id = 'unknown';
    if (meeting.user_id) {
      const { data: suUser } = await supabase
        .from('settings_users')
        .select('auth_user_id')
        .eq('id', meeting.user_id)
        .maybeSingle();
      if (suUser?.auth_user_id) {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(suUser.auth_user_id);
        tenant_id = (authUser?.app_metadata?.tenant_id as string) ?? meeting.user_id;
      }
    }
    const [gcal_sync_token, wa_confirm_token] = await Promise.all([
      issueActionToken({ action: 'gcal_sync',  resource_id: meeting_id, tenant_id, issuer: 'public-booking', ttl_seconds: 60 }),
      issueActionToken({ action: 'wa_confirm', resource_id: meeting_id, tenant_id, issuer: 'public-booking', ttl_seconds: 60 }),
    ]);

    log.info('issue_tokens_ok', { meeting_id, tenant_id });

    // Fire-and-forget: flush immediate follow-ups without waiting for the 5-min cron
    const _supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const _serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    fetch(`${_supabaseUrl}/functions/v1/process-meeting-followups`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${_serviceRole}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});

    return json({ gcal_sync_token, wa_confirm_token });
  }

  // ── ACTION: gcal_sync ──────────────────────────────────────────────────────
  // Called after book_meeting RPC confirms a public booking.
  // Pushes the meeting to the consultant's Google Calendar using service role key.
  // Requires a valid single-use action token (SCH-H-1).
  if (action === 'gcal_sync') {
    const meeting_id = body.meeting_id as string | undefined;
    if (!meeting_id) return json({ success: false, error: 'Missing meeting_id' }, 400);

    // Validate capability token — AC5 (SCH-H-1)
    const capToken = body.capability_token as string | undefined;
    if (!capToken) return json({ error: 'missing_capability_token' }, 401);
    const cap = await consumeActionToken(supabase, capToken, 'gcal_sync');
    log.info('gcal_sync_cap', { action: 'gcal_sync', meeting_id, capability_valid: cap.valid, reason: cap.valid ? undefined : cap.reason });
    if (!cap.valid) return json({ error: 'invalid_capability', reason: cap.reason }, 401);
    if (cap.resource_id !== meeting_id) return json({ error: 'meeting_mismatch' }, 403);

    // Fetch meeting with lead/person info
    const { data: meeting } = await supabase
      .from('meetings')
      .select(`
        id, start_time, end_time, notes, title, google_event_id, meeting_link, user_id,
        leads ( id, clients_people ( id, name, email ) )
      `)
      .eq('id', meeting_id)
      .single();

    if (!meeting) return json({ success: false, skipped: true, reason: 'meeting_not_found' });

    const consultorId = meeting.user_id;
    if (!consultorId) {
      await supabase.from('meetings').update({ gcal_sync_error: 'no_consultant' }).eq('id', meeting_id);
      return json({ success: false, skipped: true, reason: 'no_consultant' });
    }

    // Skip if already synced to Google Calendar
    if (meeting.google_event_id) {
      return json({ success: true, skipped: true, reason: 'already_synced', google_event_id: meeting.google_event_id });
    }

    // MULTI-CAL (ADR D4/D5): fan out over ALL google connections with sync_booking=true.
    // Ordered by created_at → the first is the PRIMARY (owns meetings.google_event_id).
    // Free/busy conflict is checked on the PRIMARY only (its calendar is the booking slot).
    // Secondary connections are best-effort; per-connection failure does not abort siblings.
    const { data: connections } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('user_id', consultorId)
      .eq('is_active', true)
      .eq('provider', 'google')
      .eq('sync_booking', true)
      .order('created_at', { ascending: true });

    if (!connections || connections.length === 0) {
      await supabase.from('meetings').update({ gcal_sync_error: 'no_calendar_connection' }).eq('id', meeting_id);
      return json({ success: false, skipped: true, reason: 'no_calendar_connection' });
    }

    // OAuth credentials: settings (CFG-05) → bi_settings fallback → env
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

    const clientName    = (meeting.leads as any)?.clients_people?.name  ?? 'Cliente';
    const clientEmail   = (meeting.leads as any)?.clients_people?.email ?? null;

    // Refresh token for one connection row, persisting by `id`. Returns token or null.
    const tokenFor = async (conn: any): Promise<string | null> => {
      let accessToken = conn.google_access_token;
      const expiresAt = conn.google_token_expires_at ? new Date(conn.google_token_expires_at) : null;
      const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;
      if (!isExpired) return accessToken;
      if (!clientId || !clientSecret) return accessToken;

      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     clientId,
          client_secret: clientSecret,
          refresh_token: conn.google_refresh_token,
          grant_type:    'refresh_token',
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
          .update({ google_access_token: accessToken, google_token_expires_at: newExpiry })
          .eq('id', conn.id);
        return accessToken;
      }
      log.warn('gcal_sync_token_refresh_failed', { connection_id: conn.id, error: refreshData.error });
      return null;
    };

    const buildEvent = (consultorEmail: string) => {
      const attendees: Array<{ email: string }> = [{ email: consultorEmail }];
      if (clientEmail) attendees.push({ email: clientEmail });
      return {
        summary: `Reunião — ${clientName}`,
        description: meeting.notes
          ? `${meeting.notes}\n\nAgendado via Growth Sales.`
          : 'Agendado via Growth Sales.',
        start: { dateTime: meeting.start_time, timeZone: 'America/Sao_Paulo' },
        end:   { dateTime: meeting.end_time,   timeZone: 'America/Sao_Paulo' },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };
    };

    const createInConnection = async (
      conn: any,
      accessToken: string,
    ): Promise<{ google_event_id: string; meet_link: string | null } | { error: string }> => {
      const calendarId = conn.google_calendar_id || 'primary';
      const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
      const createRes = await fetch(`${baseUrl}?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEvent(conn.google_email)),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return { error: `create_failed: ${createData.error?.message || createRes.status}` };
      }
      const meetLink: string | null =
        createData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ?? null;
      return { google_event_id: createData.id as string, meet_link: meetLink };
    };

    // ── PRIMARY connection: authoritative (freeBusy gate + persists event id) ──
    const primary = connections[0];
    const primaryToken = await tokenFor(primary);
    if (!primaryToken) {
      await supabase.from('meetings').update({ gcal_sync_error: 'token_refresh_failed' }).eq('id', meeting_id);
      return json({ success: false, skipped: true, reason: 'token_refresh_failed' });
    }

    // GCal double-booking check on the primary (AC1: FIX-SCH-02).
    const primaryCalId = primary.google_calendar_id || 'primary';
    const freeBusyRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${primaryToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin: meeting.start_time, timeMax: meeting.end_time, items: [{ id: primaryCalId }] }),
    });
    if (freeBusyRes.ok) {
      const fbData = await freeBusyRes.json();
      const busySlots: Array<{ start: string; end: string }> = fbData?.calendars?.[primaryCalId]?.busy ?? [];
      const slotStart = new Date(meeting.start_time).getTime();
      const slotEnd   = new Date(meeting.end_time).getTime();
      const conflict  = busySlots.some(slot =>
        new Date(slot.start).getTime() < slotEnd && new Date(slot.end).getTime() > slotStart
      );
      if (conflict) {
        log.warn('gcal_sync_conflict_detected', { meeting_id, busy_slots: busySlots.length });
        await supabase.from('meetings').update({ gcal_sync_error: 'gcal_conflict' }).eq('id', meeting_id);
        return json({ success: false, reason: 'gcal_conflict', message: 'Slot already occupied in consultant Google Calendar' }, 409);
      }
    }

    const primaryResult = await createInConnection(primary, primaryToken);
    if ('error' in primaryResult) {
      log.warn('gcal_sync_create_failed', { connection_id: primary.id, error: primaryResult.error });
      await supabase.from('meetings').update({ gcal_sync_error: primaryResult.error }).eq('id', meeting_id);
      return json({ success: false, skipped: true, reason: 'create_failed', detail: primaryResult.error });
    }

    await supabase
      .from('meetings')
      .update({
        google_event_id: primaryResult.google_event_id,
        gcal_sync_error: null,
        ...(primaryResult.meet_link ? { meeting_link: primaryResult.meet_link } : {}),
      })
      .eq('id', meeting_id);

    // ── SECONDARY connections: best-effort, failures aggregated, not aborting ──
    const secondaryErrors: string[] = [];
    let secondarySynced = 0;
    for (const conn of connections.slice(1)) {
      try {
        const tok = await tokenFor(conn);
        if (!tok) { secondaryErrors.push(`${conn.id}: token_refresh_failed`); continue; }
        const r = await createInConnection(conn, tok);
        if ('error' in r) secondaryErrors.push(`${conn.id}: ${r.error}`);
        else secondarySynced++;
      } catch (e) {
        secondaryErrors.push(`${conn.id}: ${(e as Error)?.message ?? 'exception'}`);
      }
    }
    if (secondaryErrors.length > 0) {
      log.warn('gcal_sync_secondary_partial', { meeting_id, errors: secondaryErrors });
    }

    log.info('gcal_sync_ok', { meeting_id, google_event_id: primaryResult.google_event_id, secondary_synced: secondarySynced, secondary_failed: secondaryErrors.length });
    return json({
      success: true,
      google_event_id: primaryResult.google_event_id,
      meet_link: primaryResult.meet_link,
      secondary_synced: secondarySynced,
      secondary_failed: secondaryErrors.length,
    });
  }

  // ── ACTION: wa_confirm ────────────────────────────────────────────────────
  // Send WhatsApp confirmation template after booking.
  // Requires a valid single-use action token (SCH-H-1).
  // Body: { action: "wa_confirm", meeting_id, capability_token, template_name? }
  if (action === 'wa_confirm') {
    const meeting_id = body.meeting_id as string | undefined;
    if (!meeting_id) return json({ success: false, error: 'Missing meeting_id' }, 400);

    // Validate capability token — AC6 (SCH-H-1)
    const capToken = body.capability_token as string | undefined;
    if (!capToken) return json({ error: 'missing_capability_token' }, 401);
    const cap = await consumeActionToken(supabase, capToken, 'wa_confirm');
    log.info('wa_confirm_cap', { action: 'wa_confirm', meeting_id, capability_valid: cap.valid, reason: cap.valid ? undefined : cap.reason });
    if (!cap.valid) return json({ error: 'invalid_capability', reason: cap.reason }, 401);
    if (cap.resource_id !== meeting_id) return json({ error: 'meeting_mismatch' }, 403);

    // 1. Lookup meeting (+ consultant)
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, title, start_time, end_time, meeting_link, people_id, user_id, status')
      .eq('id', meeting_id)
      .single();

    if (!meeting) return json({ success: true, skipped: true, reason: 'meeting_not_found' });
    if (!meeting.people_id) return json({ success: true, skipped: true, reason: 'no_people_id' });

    // 2. Lookup person
    const { data: person } = await supabase
      .from('clients_people')
      .select('id, name, whatsapp')
      .eq('id', meeting.people_id)
      .single();

    if (!person?.whatsapp) {
      log.warn('wa_confirm_no_whatsapp', { people_id: meeting.people_id });
      return json({ success: true, skipped: true, reason: 'no_whatsapp' });
    }

    // 3. Lookup consultant name
    let consultorName = '';
    if (meeting.user_id) {
      const { data: consultor } = await supabase
        .from('settings_users')
        .select('name')
        .eq('id', meeting.user_id)
        .maybeSingle();
      consultorName = (consultor as { name?: string } | null)?.name ?? '';
    }

    // 4. Format date/time in São Paulo timezone (start_time is timestamptz)
    const dtParts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(meeting.start_time));
    const part = (t: string) => dtParts.find((p) => p.type === t)?.value ?? '';
    const date = `${part('day')}/${part('month')}/${part('year')}`;
    const time = `${part('hour')}:${part('minute')}`;
    const firstName = (person.name || 'Cliente').split(' ')[0];
    const meetLink = meeting.meeting_link || '';

    // 5. Update lead: set control='2' (post-booking flow) + move to "Reunião Agendada" stage
    const CONSULTORIA_PIPELINE_ID = 'f8d449e5-7716-4c52-8fe7-b65cc15fb498';
    const REUNIAO_AGENDADA_STAGE_ID = 'fbb8c74f-9089-4c54-9908-dc3ac38cfa48';

    const { data: activeLead } = await supabase
      .from('leads')
      .select('id')
      .eq('people_id', meeting.people_id)
      .eq('leads_pipelines_id', CONSULTORIA_PIPELINE_ID)
      .not('status', 'in', '("lost","archived")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeLead) {
      await supabase.from('leads').update({
        control: '2',
        leads_stages_id: REUNIAO_AGENDADA_STAGE_ID,
      }).eq('id', activeLead.id);
      log.info('wa_confirm_lead_updated', { lead_id: activeLead.id, control: '2', stage: 'reuniao_agendada' });
    }

    // 6. Lookup primary template — fallback to start_diagnostico while pending
    const { data: tpl } = await supabase
      .from('whatsapp_templates')
      .select('status')
      .eq('meta_template_name', 'consultoria_reuniao_confirmada')
      .maybeSingle();

    const primaryApproved = tpl?.status === 'approved';
    const templateToSend   = primaryApproved ? 'consultoria_reuniao_confirmada' : 'start_diagnostico';
    const variableValues   = primaryApproved ? [firstName, consultorName || 'João', `${date} às ${time}`] : [];

    log.info('wa_confirm_template_resolved', { template: templateToSend, primary_status: tpl?.status ?? 'not_found', meeting_id });

    // 7. Send WhatsApp confirmation via whatsapp-outbound
    const { data: waChannel } = await supabase
      .from('settings_whatsapp_channels')
      .select('phone_number_id')
      .eq('is_default', true)
      .eq('active', true)
      .maybeSingle();

    if (!waChannel?.phone_number_id) {
      log.warn('wa_confirm_no_channel', { meeting_id });
      return json({ success: true, sent: false, reason: 'no_channel' });
    }

    // Insert message record so it appears in CRM conversation feed
    const msgContent = primaryApproved
      ? `Olá, ${firstName}! Sua sessão de diagnóstico com ${consultorName || 'João'} está confirmada para ${date} às ${time}.\n\nEnquanto a reunião não chega, me conta: qual é o principal gargalo no seu negócio que você quer resolver?`
      : 'Vamos começar seu diagnóstico para implementar IA no seu negócio?';

    const { data: msgRecord } = await supabase
      .from('messages')
      .insert({
        content: msgContent,
        from_contact: 'sistema',
        message_type: 'texto',
        status: 'sending',
        channel: 'whatsapp',
        people_id: meeting.people_id,
        lead_id: activeLead?.id ?? null,
        whatsapp_template_id: templateToSend,
      })
      .select('id')
      .single();

    const outboundRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        to: person.whatsapp,
        phone_number_id: waChannel.phone_number_id,
        people_id: meeting.people_id,
        lead_id: activeLead?.id ?? null,
        message_ids: msgRecord ? [msgRecord.id] : undefined,
        messages: [{
          type: 'template',
          template_name: templateToSend,
          variable_values: variableValues,
        }],
      }),
    });

    const sent = outboundRes.ok;
    if (!sent) {
      const errBody = await outboundRes.text().catch(() => '');
      log.warn('wa_confirm_send_failed', { meeting_id, status: outboundRes.status, body: errBody.slice(0, 200) });
    }
    log.info('wa_confirm_sent', { meeting_id, sent, people_id: meeting.people_id });
    return json({ success: true, sent });
  }

  return json({ error: 'Unknown action' }, 400);

  } catch (err: unknown) {
    log.error('unhandled_error', { error: err instanceof Error ? err.message : String(err) });
    return json({ error: 'Internal server error' }, 500);
  }
});
