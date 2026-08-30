// agents-meeting-create — ORA voice agent tool
//
// Body: { lead_id, scheduled_date (YYYY-MM-DD), start_time (HH:mm), end_time (HH:mm), meeting_duration_minutes? }
// Returns: { ok, meeting_id, conflict?, error? }
//
// Validates date/time, re-checks for conflicts, INSERTs into meetings,
// and updates the lead stage to "Agendado" (if a stage with that name exists).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SECRET = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REPLAY_WINDOW_SEC = 30 * 60;
const TZ_OFFSET_HOURS = -3;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, elevenlabs-signature',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function verifyHmac(rawBody: string, sigHeader: string | null): Promise<boolean> {
  if (!SECRET) return true;
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=').map((s) => s.trim())));
  const ts = parts['t'];
  const sig = parts['v0'];
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(ts, 10)) > REPLAY_WINDOW_SEC) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('') === sig;
}

function brtToUtc(date: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const utc = Date.UTC(
    parseInt(date.slice(0, 4)),
    parseInt(date.slice(5, 7)) - 1,
    parseInt(date.slice(8, 10)),
    h - TZ_OFFSET_HOURS,
    m,
    0,
  );
  return new Date(utc).toISOString();
}

function isValidDateStr(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function isValidTimeStr(s: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get('elevenlabs-signature') || req.headers.get('ElevenLabs-Signature');
    if (!(await verifyHmac(rawBody, sigHeader))) return json({ error: 'invalid_signature' }, 401);

    const body = JSON.parse(rawBody) as {
      lead_id?: string; scheduled_date?: string; start_time?: string; end_time?: string; meeting_duration_minutes?: number;
    };

    if (!body.lead_id || !body.scheduled_date || !body.start_time || !body.end_time) {
      return json({ ok: false, error: 'missing_required_fields' }, 400);
    }
    if (!isValidDateStr(body.scheduled_date) || !isValidTimeStr(body.start_time) || !isValidTimeStr(body.end_time)) {
      return json({ ok: false, error: 'invalid_format' }, 400);
    }

    const startIso = brtToUtc(body.scheduled_date, body.start_time);
    const endIso = brtToUtc(body.scheduled_date, body.end_time);

    if (new Date(startIso).getTime() <= Date.now()) {
      return json({ ok: false, error: 'in_the_past' }, 400);
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      return json({ ok: false, error: 'end_before_start' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: lead } = await supabase
      .from('leads')
      .select('id, user_id, leads_pipelines_id, leads_stages_id')
      .eq('id', body.lead_id)
      .maybeSingle();
    if (!lead) return json({ ok: false, error: 'lead_not_found' }, 404);

    // Re-check conflict in DB
    const { data: conflicts } = await supabase
      .from('meetings')
      .select('id')
      .eq('user_id', lead.user_id)
      .neq('status', 'cancelled')
      .lt('start_time', endIso)
      .gt('end_time', startIso);

    if ((conflicts ?? []).length > 0) {
      return json({ ok: false, conflict: true, error: 'time_already_booked' }, 200);
    }

    const { data: meeting, error: insErr } = await supabase
      .from('meetings')
      .insert({
        lead_id: lead.id,
        user_id: lead.user_id,
        title: 'Reunião agendada via ORA',
        start_time: startIso,
        end_time: endIso,
        status: 'agendado',
        meeting_type: 'discovery',
        source: 'voice_agent',
      })
      .select('id')
      .single();

    if (insErr || !meeting) {
      console.error('meeting-create insert error:', insErr);
      return json({ ok: false, error: 'insert_failed' }, 500);
    }

    // Move lead stage via schedule_automations (configurable in UI)
    if (lead.leads_pipelines_id) {
      const { data: rule } = await supabase
        .from('schedule_automations')
        .select('target_pipeline_id, target_stage_id')
        .eq('pipeline_id', lead.leads_pipelines_id)
        .eq('trigger_status', 'criado')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (rule) {
        await supabase.from('leads').update({
          leads_stages_id: rule.target_stage_id,
          leads_pipelines_id: rule.target_pipeline_id,
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id);
      }
    }

    console.log(`meeting-create: ok meeting=${meeting.id} lead=${lead.id}`);
    return json({ ok: true, meeting_id: meeting.id });
  } catch (err) {
    console.error('agents-meeting-create error', err);
    return json({ ok: false, error: 'internal' }, 500);
  }
});
