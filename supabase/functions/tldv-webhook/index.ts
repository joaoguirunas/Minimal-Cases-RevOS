/**
 * tl;dv — Webhook Receiver
 *
 * POST /tldv-webhook  (--no-verify-jwt)
 *
 * Events:
 *   MeetingReady     → insere ai_summary + recording em meeting_records,
 *                       atualiza meetings.status para 'realizado'
 *   TranscriptReady  → insere transcript em meeting_records
 *
 * Security: header customizado configurado em omni_channel_configs (channel='tldv')
 * Idempotência: tldv_meeting_id já existente → skip
 *
 * IMPORTANTE: retorna sempre HTTP 200 para que o tl;dv não re-enfileire o evento.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  TldvApiClient,
  TldvMeetingData,
  findMatchingMeeting,
  loadTldvCredentials,
  tldvRecordExists,
} from '../_shared/tldv-matching.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(body: Record<string, unknown> = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleMeetingReady(
  supabase: ReturnType<typeof createClient>,
  tldv: TldvApiClient,
  data: TldvMeetingData,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  // Idempotência — verifica tldv_meeting_id principal
  const alreadyExists = await tldvRecordExists(supabase, data.id);
  if (alreadyExists) {
    log.info('MeetingReady already processed — skip', { tldv_id: data.id });
    return;
  }

  const emails = [
    data.organizer?.email,
    ...(data.invitees ?? []).map((i) => i.email),
  ].filter(Boolean) as string[];

  const { meeting_id } = await findMatchingMeeting(supabase, data.happenedAt, emails);

  log.info('MeetingReady match result', { tldv_id: data.id, meeting_id });

  // Buscar notas independentemente do match — precisamos delas para o ai_summary
  let markdownContent = '';
  let topics: string[] = [];

  try {
    const notes = await tldv.getNotes(data.id);
    markdownContent = notes.markdownContent ?? '';
    topics = (notes.topics ?? []).map((t) => t.title).filter(Boolean);
  } catch (err) {
    log.warn('Failed to fetch tl;dv notes — proceeding without them', {
      tldv_id: data.id,
      error: (err as Error).message,
    });
  }

  if (!meeting_id) {
    // Sem match — guardar apenas em ai_metadata para revisão manual.
    // Não inserimos com meeting_id=null porque a coluna pode ser NOT NULL;
    // registamos em ai_metadata para auditoria.
    log.warn('MeetingReady: no matching RevOS meeting found — storing unmatched metadata', {
      tldv_id: data.id,
      organizer: data.organizer?.email,
    });

    // Tentativa de inserção com meeting_id=null — se falhar silenciosamente, apenas loga.
    const { error: insertErr } = await supabase.from('meeting_records').insert({
      record_type: 'ai_summary',
      source: 'tldv',
      content: markdownContent,
      content_format: 'markdown',
      ai_key_topics: topics,
      tldv_meeting_id: data.id,
      recorded_at: data.happenedAt,
      duration_seconds: data.duration,
      title: data.name,
      url: data.url,
      ai_metadata: { unmatched: true, tldv_data: data },
    });

    if (insertErr) {
      log.warn('Could not insert unmatched record (likely NOT NULL constraint) — event logged only', {
        tldv_id: data.id,
        error: insertErr.message,
      });
    }

    return;
  }

  // ── Inserir ai_summary ────────────────────────────────────────────────────
  const { error: summaryErr } = await supabase.from('meeting_records').insert({
    meeting_id,
    record_type: 'ai_summary',
    source: 'tldv',
    content: markdownContent,
    content_format: 'markdown',
    ai_key_topics: topics,
    tldv_meeting_id: data.id,
    recorded_at: data.happenedAt,
    duration_seconds: data.duration,
    title: data.name,
    url: data.url,
  });

  if (summaryErr) {
    log.error('Failed to insert ai_summary record', {
      tldv_id: data.id,
      error: summaryErr.message,
    });
  }

  // ── Inserir recording ─────────────────────────────────────────────────────
  const { error: recErr } = await supabase.from('meeting_records').insert({
    meeting_id,
    record_type: 'recording',
    source: 'tldv',
    url: data.url,
    duration_seconds: data.duration,
    tldv_meeting_id: `${data.id}_rec`,
    recorded_at: data.happenedAt,
    title: data.name,
  });

  if (recErr) {
    log.error('Failed to insert recording record', {
      tldv_id: data.id,
      error: recErr.message,
    });
  }

  // ── Atualizar status da reunião ────────────────────────────────────────────
  const { error: statusErr } = await supabase
    .from('meetings')
    .update({ status: 'realizado' })
    .eq('id', meeting_id)
    .in('status', ['agendada', 'agendado']);

  if (statusErr) {
    log.warn('Failed to update meeting status', {
      meeting_id,
      error: statusErr.message,
    });
  }
}

async function handleTranscriptReady(
  supabase: ReturnType<typeof createClient>,
  tldv: TldvApiClient,
  data: { meetingId: string; data: { segments: Array<{ speaker: string; text: string; startTime: number; endTime: number }> } },
  log: ReturnType<typeof createLogger>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const transcriptTldvId = `${data.meetingId}_transcript`;

  // Idempotência
  const alreadyExists = await tldvRecordExists(supabase, transcriptTldvId);
  if (alreadyExists) {
    log.info('TranscriptReady already processed — skip', { tldv_id: data.meetingId });
    return;
  }

  // Buscar metadados completos da reunião
  let meetingData: TldvMeetingData | null = null;
  try {
    meetingData = await tldv.getMeeting(data.meetingId);
  } catch (err) {
    log.warn('Failed to fetch meeting metadata for transcript', {
      tldv_id: data.meetingId,
      error: (err as Error).message,
    });
  }

  // Encontrar o meeting_record pai (criado pelo MeetingReady)
  const { data: parentRecord } = await supabase
    .from('meeting_records')
    .select('id, meeting_id')
    .eq('tldv_meeting_id', data.meetingId)
    .maybeSingle();

  const meetingId = parentRecord?.meeting_id ?? null;

  // Construir texto da transcrição
  const segments = data.data?.segments ?? [];
  const transcriptText = segments
    .map((s) => `${s.speaker}: ${s.text}`)
    .join('\n');

  const insertPayload: Record<string, unknown> = {
    record_type: 'transcript',
    source: 'tldv',
    content: transcriptText,
    content_format: 'text',
    transcript_json: data.data,
    tldv_meeting_id: transcriptTldvId,
    recorded_at: meetingData?.happenedAt ?? new Date().toISOString(),
    title: meetingData ? `${meetingData.name} — Transcrição` : 'Transcrição tl;dv',
  };

  if (meetingId) {
    insertPayload.meeting_id = meetingId;
  }

  const { error: insertErr } = await supabase
    .from('meeting_records')
    .insert(insertPayload);

  if (insertErr) {
    // Se falhou por NOT NULL em meeting_id, registar sem meeting_id não é possível —
    // apenas logar para revisão.
    log.error('Failed to insert transcript record', {
      tldv_id: data.meetingId,
      error: insertErr.message,
    });
    return;
  }

  log.info('TranscriptReady processed', {
    tldv_id: data.meetingId,
    meeting_id: meetingId,
    segments: segments.length,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('tldv-webhook');

  if (req.method !== 'POST') {
    log.warn('Method not allowed', { method: req.method });
    return ok({ ok: false, error: 'method_not_allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── Carregar credenciais ─────────────────────────────────────────────────
    const creds = await loadTldvCredentials(supabase);

    if (!creds) {
      log.error('tl;dv channel not configured or inactive');
      // Retorna 200 para não causar retentativas do tl;dv
      return ok({ ok: false, error: 'channel_not_configured' });
    }

    // ── Validar header de segurança ──────────────────────────────────────────
    if (creds.webhook_header_name && creds.webhook_header_value) {
      const headerVal = req.headers.get(creds.webhook_header_name);
      if (headerVal !== creds.webhook_header_value) {
        log.warn('Webhook security header mismatch — rejecting', {
          header: creds.webhook_header_name,
        });
        return ok({ ok: false, error: 'unauthorized' });
      }
    } else {
      log.warn('Webhook security header not configured — accepting without validation');
    }

    // ── Parse body ───────────────────────────────────────────────────────────
    let body: { event: string; data: unknown };
    try {
      body = await req.json();
    } catch {
      log.error('Invalid JSON body');
      return ok({ ok: false, error: 'invalid_json' });
    }

    const { event, data } = body;
    log.info('Received event', { event });

    const tldv = new TldvApiClient(creds.api_key);

    // ── Route event ──────────────────────────────────────────────────────────
    switch (event) {
      case 'MeetingReady': {
        await handleMeetingReady(
          supabase,
          tldv,
          data as Parameters<typeof handleMeetingReady>[2],
          log,
        );
        break;
      }

      case 'TranscriptReady': {
        await handleTranscriptReady(
          supabase,
          tldv,
          data as Parameters<typeof handleTranscriptReady>[2],
          log,
          supabaseUrl,
          supabaseServiceKey,
        );
        break;
      }

      default: {
        log.warn('Unknown tl;dv event — ignoring', { event });
        break;
      }
    }

    return ok({ ok: true, event });
  } catch (err) {
    // Captura global — retorna sempre 200 para o tl;dv não re-enfileirar.
    log.error('Unhandled error in tldv-webhook', {
      error: (err as Error).message,
    });
    return ok({ ok: true, internal_error: true });
  }
});
