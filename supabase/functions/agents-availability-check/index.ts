// agents-availability-check — ORA voice agent tool
//
// Body: { lead_id }
// Returns: { has_availability, has_night_availability, next_slots[], next_slots_text }
//
// Resolves the lead's assigned broker (leads.user_id), checks Google Calendar
// FreeBusy + already-booked meetings, and computes free 60-min slots in the next 5 business days
// during 09:00-22:00 (BRT). "Night" = >=18:00.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SECRET = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REPLAY_WINDOW_SEC = 30 * 60;

const TZ_OFFSET_HOURS = -3; // BRT — adjust if needed
const SLOT_MINUTES = 60;
const DAY_START_H = 9;
const DAY_END_H = 22;
const NIGHT_START_H = 18;
const LOOKAHEAD_DAYS = 5;
const MAX_SLOTS_RETURNED = 6;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, elevenlabs-signature',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function verifyHmac(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!SECRET) return true;
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=').map((s) => s.trim())));
  const ts = parts['t'];
  const sig = parts['v0'];
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > REPLAY_WINDOW_SEC) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return expected === sig;
}

interface Slot { date: string; start: string; end: string; startUtc: number; endUtc: number; }

function localDateStr(d: Date): string {
  // Convert to BRT then take YYYY-MM-DD
  const brt = new Date(d.getTime() + TZ_OFFSET_HOURS * 3600_000);
  return brt.toISOString().slice(0, 10);
}

function buildSlotCandidates(now: Date): Slot[] {
  const out: Slot[] = [];
  // Start from now+1h, rounded up to next hour
  let cursor = new Date(Math.ceil((now.getTime() + 3600_000) / 3600_000) * 3600_000);

  for (let day = 0; day < LOOKAHEAD_DAYS; day++) {
    const base = new Date(now.getTime() + day * 86400_000);
    const dow = (base.getUTCDay() + (base.getUTCHours() + TZ_OFFSET_HOURS >= 0 ? 0 : -1) + 7) % 7;
    if (dow === 0 || dow === 6) continue; // skip Sun/Sat

    for (let h = DAY_START_H; h < DAY_END_H; h++) {
      // Build UTC datetime for this BRT hour
      const ymd = localDateStr(base);
      const utcMs = Date.UTC(
        parseInt(ymd.slice(0, 4)),
        parseInt(ymd.slice(5, 7)) - 1,
        parseInt(ymd.slice(8, 10)),
        h - TZ_OFFSET_HOURS,
        0,
        0,
      );
      if (utcMs < cursor.getTime()) continue;

      out.push({
        date: ymd,
        start: `${String(h).padStart(2, '0')}:00`,
        end: `${String(h + 1).padStart(2, '0')}:00`,
        startUtc: utcMs,
        endUtc: utcMs + SLOT_MINUTES * 60_000,
      });
    }
  }
  return out;
}

async function getCalendarBusy(supabase: any, userId: string, fromUtc: number, toUtc: number): Promise<{ start: number; end: number }[]> {
  const { data: conn } = await supabase
    .from('user_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!conn) return [];

  // Refresh token if needed
  let accessToken = conn.google_access_token;
  const expiresAt = conn.google_token_expires_at ? new Date(conn.google_token_expires_at).getTime() : 0;
  if (!expiresAt || expiresAt - Date.now() < 60_000) {
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('google_client_id, google_client_secret')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const clientId = settingsRow?.google_client_id ?? Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
    const clientSecret = settingsRow?.google_client_secret ?? Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
    if (!clientId || !clientSecret) return [];

    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const j = await refreshRes.json();
    if (!refreshRes.ok || !j.access_token) {
      console.warn('availability: token refresh failed', j);
      return [];
    }
    accessToken = j.access_token;
    await supabase
      .from('user_calendar_connections')
      .update({
        google_access_token: accessToken,
        google_token_expires_at: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: new Date(fromUtc).toISOString(),
      timeMax: new Date(toUtc).toISOString(),
      items: [{ id: conn.google_calendar_id || 'primary' }],
    }),
  });
  if (!fbRes.ok) return [];
  const fb = await fbRes.json();
  const calId = conn.google_calendar_id || 'primary';
  const busy = fb.calendars?.[calId]?.busy ?? [];
  return busy.map((b: any) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get('elevenlabs-signature') || req.headers.get('ElevenLabs-Signature');
    if (!(await verifyHmac(rawBody, sigHeader))) return json({ error: 'invalid_signature' }, 401);

    const { lead_id } = JSON.parse(rawBody) as { lead_id?: string };
    if (!lead_id) return json({ error: 'missing_lead_id', has_availability: false, has_night_availability: false, next_slots: [], next_slots_text: '' }, 200);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: lead } = await supabase
      .from('leads')
      .select('id, user_id')
      .eq('id', lead_id)
      .maybeSingle();
    if (!lead?.user_id) {
      return json({ has_availability: true, has_night_availability: true, next_slots: [], next_slots_text: 'Sem corretor atribuído — sugira agendar e o corretor confirma depois' });
    }

    const now = new Date();
    const candidates = buildSlotCandidates(now);
    if (candidates.length === 0) {
      return json({ has_availability: false, has_night_availability: false, next_slots: [], next_slots_text: 'Sem horários disponíveis nos próximos dias' });
    }

    const fromUtc = candidates[0].startUtc;
    const toUtc = candidates[candidates.length - 1].endUtc;

    // Existing meetings in DB
    const { data: existingMeetings } = await supabase
      .from('meetings')
      .select('start_time, end_time')
      .eq('user_id', lead.user_id)
      .gte('start_time', new Date(fromUtc).toISOString())
      .lte('end_time', new Date(toUtc).toISOString())
      .neq('status', 'cancelled');
    const dbBusy = (existingMeetings ?? []).map((m: any) => ({
      start: new Date(m.start_time).getTime(),
      end: new Date(m.end_time).getTime(),
    }));

    // Google Calendar busy
    const gcalBusy = await getCalendarBusy(supabase, lead.user_id, fromUtc, toUtc);
    const allBusy = [...dbBusy, ...gcalBusy];

    const free = candidates.filter((slot) => !allBusy.some((b) => slot.startUtc < b.end && slot.endUtc > b.start));
    const trimmed = free.slice(0, MAX_SLOTS_RETURNED);

    const hasAny = trimmed.length > 0;
    const hasNight = trimmed.some((s) => parseInt(s.start.slice(0, 2), 10) >= NIGHT_START_H);

    const nextSlotsText = trimmed.length === 0
      ? 'Sem horários disponíveis nos próximos dias úteis'
      : trimmed.map((s) => `${s.date} às ${s.start}`).join('; ');

    console.log(`availability: lead=${lead_id} user=${lead.user_id} slots=${trimmed.length}`);
    return json({
      has_availability: hasAny,
      has_night_availability: hasNight,
      next_slots: trimmed.map(({ date, start, end }) => ({ date, start, end })),
      next_slots_text: nextSlotsText,
    });
  } catch (err) {
    console.error('agents-availability-check error', err);
    return json({ has_availability: false, has_night_availability: false, next_slots: [], next_slots_text: 'Erro ao consultar agenda' }, 200);
  }
});
