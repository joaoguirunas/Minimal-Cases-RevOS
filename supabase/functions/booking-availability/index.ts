/**
 * Schedule PRO™ — Public Booking com Google Calendar freebusy (FEAT-AGENDAR-GCAL-FREEBUSY-01)
 *
 * Wrapper público do agendamento /agendar que respeita o Google Calendar EXTERNO
 * dos consultores, em DUAS frentes:
 *
 *   action (default) — disponibilidade:
 *     Chama get_booking_session (slots + user_ids = pool de candidatos livres na
 *     agenda interna) e remove os slots em que TODOS os candidatos estão ocupados
 *     (interno OU Google Calendar). Retorna { person, slots, existing_meeting? }.
 *
 *   action='confirm' — agendamento:
 *     Para o horário escolhido, descobre quais consultores elegíveis estão ocupados
 *     no Google Calendar e os passa como p_exclude_user_ids ao book_meeting, para a
 *     reunião NÃO ser atribuída a quem está ocupado externamente.
 *
 * Fallback gracioso: falha de freebusy de um consultor => tratado como LIVRE (nunca
 * derruba o booking). Auth: público (verify_jwt=false), igual ao acesso à RPC.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const SP_OFFSET = '-03:00'; // São Paulo, sem DST desde 2019 — mesmo offset que /agendar usa

interface BusyInterval { start: number; end: number } // epoch ms (UTC)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function stripUserIds(session: Record<string, unknown>): Record<string, unknown> {
  const slots = Array.isArray(session.slots)
    ? session.slots.map((s: Record<string, unknown>) => ({ date: s.date, start_time: s.start_time, end_time: s.end_time }))
    : session.slots;
  return { ...session, slots };
}

async function resolveGoogleCreds(supabase: SupabaseClient): Promise<{ clientId: string; clientSecret: string }> {
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
  return { clientId, clientSecret };
}

/** Busy intervals (epoch ms) de um consultor no Google Calendar na janela [timeMin,timeMax].
 * `connected: false` significa "sem Google Calendar ativo" — tratado como NÃO ELEGÍVEL
 * pelo caller (não como livre nem como ocupado), pra evitar over-booking de quem nunca
 * conectou a agenda. Falhas de API/refresh (com conexão existente) continuam graceful
 * (tratadas como livre) — só a AUSÊNCIA de conexão vira exclusão. */
async function getUserBusy(
  supabase: SupabaseClient,
  userId: string,
  creds: { clientId: string; clientSecret: string },
  timeMinISO: string,
  timeMaxISO: string,
): Promise<{ busy: BusyInterval[]; connected: boolean }> {
  const { data: connection } = await supabase
    .from('user_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!connection) return { busy: [], connected: false }; // sem conexão → não elegível

  let accessToken = connection.google_access_token as string;
  const expiresAt = connection.google_token_expires_at ? new Date(connection.google_token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

  if (isExpired) {
    if (!creds.clientId || !creds.clientSecret || !connection.google_refresh_token) return { busy: [], connected: true };
    const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: connection.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const refreshData = await refreshRes.json();
    if (!refreshRes.ok || !refreshData.access_token) {
      console.warn(`[booking-availability] token refresh failed for ${userId}`);
      return { busy: [], connected: true };
    }
    accessToken = refreshData.access_token;
    const newExpiry = refreshData.expires_in ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString() : null;
    await supabase
      .from('user_calendar_connections')
      .update({ google_access_token: accessToken, google_token_expires_at: newExpiry, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  const calendarId = connection.google_calendar_id || 'primary';
  const fbRes = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: calendarId }] }),
  });
  if (!fbRes.ok) {
    console.warn(`[booking-availability] freeBusy API error for ${userId}: ${fbRes.status}`);
    return { busy: [], connected: true };
  }
  const fbData = await fbRes.json();
  const busy: Array<{ start: string; end: string }> = fbData.calendars?.[calendarId]?.busy ?? [];
  return { busy: busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })), connected: true };
}

/** Mapa user_id -> busy[] + conjunto de quem não tem Google Calendar conectado, em paralelo. */
async function busyForUsers(
  supabase: SupabaseClient,
  userIds: string[],
  timeMinISO: string,
  timeMaxISO: string,
): Promise<{ busyByUser: Record<string, BusyInterval[]>; noConnectionUserIds: Set<string> }> {
  const creds = await resolveGoogleCreds(supabase);
  const busyByUser: Record<string, BusyInterval[]> = {};
  const noConnectionUserIds = new Set<string>();
  await Promise.all(userIds.map(async (uid) => {
    try {
      const { busy, connected } = await getUserBusy(supabase, uid, creds, timeMinISO, timeMaxISO);
      busyByUser[uid] = busy;
      if (!connected) noConnectionUserIds.add(uid);
    } catch (e) {
      console.warn(`[booking-availability] busy fetch threw for ${uid} — treating as free`, (e as Error)?.message);
      busyByUser[uid] = [];
    }
  }));
  return { busyByUser, noConnectionUserIds };
}

// ── action (default): disponibilidade ────────────────────────────────────────
async function handleAvailability(supabase: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const { lead_id, rule_set_id = null, duration = 30, days_ahead = 14 } = body as {
    lead_id?: string; rule_set_id?: string | null; duration?: number; days_ahead?: number;
  };
  if (!lead_id) return json({ error: 'lead_id é obrigatório' }, 400);

  const { data: session, error: rpcErr } = await supabase.rpc('get_booking_session', {
    p_lead_id: lead_id, p_rule_set_id: rule_set_id, p_duration: duration, p_days_ahead: days_ahead,
  });
  if (rpcErr) return json({ error: rpcErr.message }, 200);
  if (!session || session.error) return json(session ?? { error: 'no_session' }, 200);
  if (session.existing_meeting || !Array.isArray(session.slots) || session.slots.length === 0) {
    return json(stripUserIds(session));
  }

  const userIds = [...new Set<string>(
    session.slots.flatMap((s: Record<string, unknown>) => (Array.isArray(s.user_ids) ? s.user_ids as string[] : [])),
  )];
  const timeMinISO = new Date().toISOString();
  const timeMaxISO = new Date(Date.now() + days_ahead * 86_400_000).toISOString();
  const { busyByUser, noConnectionUserIds } = await busyForUsers(supabase, userIds, timeMinISO, timeMaxISO);

  const before = session.slots.length;
  const filteredSlots = session.slots.filter((s: Record<string, unknown>) => {
    const slotStart = Date.parse(`${s.date}T${s.start_time}:00${SP_OFFSET}`);
    const slotEnd = Date.parse(`${s.date}T${s.end_time}:00${SP_OFFSET}`);
    const ids = Array.isArray(s.user_ids) ? (s.user_ids as string[]) : [];
    return ids.some((uid) => {
      if (noConnectionUserIds.has(uid)) return false; // sem GCal ativo → não elegível
      const busy = busyByUser[uid] ?? [];
      return !busy.some((b) => b.start < slotEnd && b.end > slotStart);
    });
  });
  console.log(`[booking-availability] lead=${lead_id} consultores=${userIds.length} slots ${before} -> ${filteredSlots.length} (gcal removeu ${before - filteredSlots.length}, sem conexão=${noConnectionUserIds.size})`);

  return json(stripUserIds({ ...session, slots: filteredSlots }));
}

// ── action='confirm': agenda respeitando o GCal na ATRIBUIÇÃO ──────────────────
async function handleConfirm(supabase: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const { lead_id, start_time, end_time, rule_set_id = null, duration = 30, notes = null } = body as {
    lead_id?: string; start_time?: string; end_time?: string; rule_set_id?: string | null; duration?: number; notes?: string | null;
  };
  if (!lead_id || !start_time || !end_time) return json({ error: 'lead_id, start_time e end_time são obrigatórios' }, 400);

  // Consultores elegíveis para este rule set
  const { data: eligible } = await supabase.rpc('get_booking_eligible_user_ids', { p_rule_set_id: rule_set_id });
  const eligibleIds: string[] = Array.isArray(eligible) ? eligible : [];

  // Quem está ocupado no Google Calendar (ou não tem conexão ativa) no horário escolhido → excluir da atribuição
  let excludeIds: string[] = [];
  if (eligibleIds.length > 0) {
    const slotStart = Date.parse(start_time);
    const slotEnd = Date.parse(end_time);
    const { busyByUser, noConnectionUserIds } = await busyForUsers(supabase, eligibleIds, start_time, end_time);
    excludeIds = eligibleIds.filter((uid) =>
      noConnectionUserIds.has(uid) || (busyByUser[uid] ?? []).some((b) => b.start < slotEnd && b.end > slotStart),
    );
    console.log(`[booking-availability:confirm] lead=${lead_id} excluídos por GCal/sem-conexão=${JSON.stringify(excludeIds)}`);
  }

  const { data: result, error: bookErr } = await supabase.rpc('book_meeting', {
    p_lead_id: lead_id,
    p_start_time: start_time,
    p_end_time: end_time,
    p_rule_set_id: rule_set_id,
    p_duration: duration,
    p_notes: notes,
    p_exclude_user_ids: excludeIds,
  });
  if (bookErr) return json({ error: bookErr.message }, 200);
  return json(result);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    if (body?.action === 'confirm') return await handleConfirm(supabase, body);
    return await handleAvailability(supabase, body);
  } catch (err) {
    console.error('[booking-availability] unexpected error', err);
    return json({ error: (err as Error)?.message ?? 'internal_error' }, 200);
  }
});
