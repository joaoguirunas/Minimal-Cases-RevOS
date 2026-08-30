// agents-lead-stage-update — ORA voice agent tool
//
// Body: { lead_id, stage: "qualification" | "call-again" | "no-interest", reason? }
// Returns: { ok, stage_id?, error? }
//
// Stage mapping (case-insensitive name match in active pipeline):
//   qualification → first stage matching "cadência" / "cadencia"
//   call-again    → first stage matching "tentativa" / "contato"
//   no-interest   → marks lead as status='lost' (no stage move)
//
// Also logs the reason as a message row (channel=telefone, from_contact=agente_ia)
// for inbox visibility, when reason is provided.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SECRET = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REPLAY_WINDOW_SEC = 30 * 60;

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

const STAGE_PATTERNS: Record<string, string[]> = {
  'qualification': ['cadência', 'cadencia', 'qualificação', 'qualificacao'],
  'call-again': ['tentativa', 'contato', 'recontatar'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get('elevenlabs-signature') || req.headers.get('ElevenLabs-Signature');
    if (!(await verifyHmac(rawBody, sigHeader))) return json({ error: 'invalid_signature' }, 401);

    const body = JSON.parse(rawBody) as { lead_id?: string; stage?: string; reason?: string };
    if (!body.lead_id || !body.stage) return json({ ok: false, error: 'missing_fields' }, 400);

    const stage = body.stage.toLowerCase();
    if (!['qualification', 'call-again', 'no-interest'].includes(stage)) {
      return json({ ok: false, error: 'invalid_stage' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: lead } = await supabase
      .from('leads')
      .select('id, leads_pipelines_id, status')
      .eq('id', body.lead_id)
      .maybeSingle();
    if (!lead) return json({ ok: false, error: 'lead_not_found' }, 404);

    if (stage === 'no-interest') {
      await supabase.from('leads').update({ status: 'lost', updated_at: new Date().toISOString() }).eq('id', lead.id);
    } else {
      const patterns = STAGE_PATTERNS[stage] || [];
      let stageId: string | null = null;

      for (const p of patterns) {
        const { data: row } = await supabase
          .from('leads_stages')
          .select('id, name')
          .eq('leads_pipelines_id', lead.leads_pipelines_id)
          .eq('active', true)
          .ilike('name', `%${p}%`)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (row) { stageId = row.id; break; }
      }

      if (!stageId) {
        console.warn(`stage-update: no matching stage for "${stage}" in pipeline ${lead.leads_pipelines_id}`);
        return json({ ok: false, error: 'stage_not_found_in_pipeline' }, 200);
      }

      await supabase.from('leads').update({ leads_stages_id: stageId, updated_at: new Date().toISOString() }).eq('id', lead.id);
    }

    if (body.reason) {
      await supabase.from('messages').insert({
        lead_id: lead.id,
        channel: 'telefone',
        from_contact: 'agente_ia',
        message_type: 'texto',
        content: `[stage:${stage}] ${body.reason}`,
      }).then(undefined, (e) => console.warn('message log failed:', e));
    }

    console.log(`stage-update: ok lead=${lead.id} stage=${stage}`);
    return json({ ok: true });
  } catch (err) {
    console.error('agents-lead-stage-update error', err);
    return json({ ok: false, error: 'internal' }, 500);
  }
});
