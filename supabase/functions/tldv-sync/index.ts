/**
 * tl;dv — Sync Manual
 *
 * POST /tldv-sync  (--no-verify-jwt)
 *
 * Body: { days?: number }  (default: 7)
 *
 * Percorre todas as reuniões tl;dv dos últimos N dias e sincroniza
 * as que ainda não existem em meeting_records.
 *
 * Retorna:
 *   { synced, already_synced, unmatched, unmatched_meetings: [{id, name, happenedAt, organizer}] }
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Process a single tl;dv meeting ───────────────────────────────────────────

async function processMeeting(
  supabase: ReturnType<typeof createClient>,
  tldv: TldvApiClient,
  meeting: TldvMeetingData,
  log: ReturnType<typeof createLogger>,
): Promise<'synced' | 'already_synced' | 'unmatched'> {
  // Idempotência — verifica pelo id principal
  const alreadyExists = await tldvRecordExists(supabase, meeting.id);
  if (alreadyExists) {
    log.debug('Already synced — skip', { tldv_id: meeting.id });
    return 'already_synced';
  }

  const emails = [
    meeting.organizer?.email,
    ...(meeting.invitees ?? []).map((i) => i.email),
  ].filter(Boolean) as string[];

  const { meeting_id } = await findMatchingMeeting(supabase, meeting.happenedAt, emails);

  if (!meeting_id) {
    log.info('No RevOS meeting match found', {
      tldv_id: meeting.id,
      name: meeting.name,
      happenedAt: meeting.happenedAt,
    });
    return 'unmatched';
  }

  // Buscar notas
  let markdownContent = '';
  let topics: string[] = [];

  try {
    const notes = await tldv.getNotes(meeting.id);
    markdownContent = notes.markdownContent ?? '';
    topics = (notes.topics ?? []).map((t) => t.title).filter(Boolean);
  } catch (err) {
    log.warn('Failed to fetch notes during sync', {
      tldv_id: meeting.id,
      error: (err as Error).message,
    });
  }

  // Inserir ai_summary
  const { error: summaryErr } = await supabase.from('meeting_records').insert({
    meeting_id,
    record_type: 'ai_summary',
    source: 'tldv',
    content: markdownContent,
    content_format: 'markdown',
    ai_key_topics: topics,
    tldv_meeting_id: meeting.id,
    recorded_at: meeting.happenedAt,
    duration_seconds: meeting.duration,
    title: meeting.name,
    url: meeting.url,
  });

  if (summaryErr) {
    log.error('Failed to insert ai_summary during sync', {
      tldv_id: meeting.id,
      error: summaryErr.message,
    });
  }

  // Inserir recording
  const { error: recErr } = await supabase.from('meeting_records').insert({
    meeting_id,
    record_type: 'recording',
    source: 'tldv',
    url: meeting.url,
    duration_seconds: meeting.duration,
    tldv_meeting_id: `${meeting.id}_rec`,
    recorded_at: meeting.happenedAt,
    title: meeting.name,
  });

  if (recErr) {
    log.warn('Failed to insert recording during sync', {
      tldv_id: meeting.id,
      error: recErr.message,
    });
  }

  // Atualizar status
  const { error: statusErr } = await supabase
    .from('meetings')
    .update({ status: 'realizado' })
    .eq('id', meeting_id)
    .in('status', ['agendada', 'agendado']);

  if (statusErr) {
    log.warn('Failed to update meeting status during sync', {
      meeting_id,
      error: statusErr.message,
    });
  }

  log.info('Meeting synced', { tldv_id: meeting.id, meeting_id });
  return 'synced';
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('tldv-sync');

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── Carregar credenciais ─────────────────────────────────────────────────
    const creds = await loadTldvCredentials(supabase);

    if (!creds) {
      log.error('tl;dv channel not configured or inactive');
      return jsonResponse({ ok: false, error: 'channel_not_configured' });
    }

    // ── Parse body ───────────────────────────────────────────────────────────
    let days = 7;
    try {
      const body = await req.json();
      if (typeof body?.days === 'number' && body.days > 0) {
        days = Math.min(body.days, 365); // cap em 1 ano
      }
    } catch {
      // body vazio ou inválido — usar default
    }

    const now = new Date();
    const dateTo = now.toISOString();
    const dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    log.info('Starting sync', { days, dateFrom, dateTo });

    // ── Listar todas as reuniões ──────────────────────────────────────────────
    const tldv = new TldvApiClient(creds.api_key);
    let meetings: TldvMeetingData[] = [];

    try {
      meetings = await tldv.listAllMeetings(dateFrom, dateTo);
    } catch (err) {
      log.error('Failed to list tl;dv meetings', { error: (err as Error).message });
      return jsonResponse({ ok: false, error: 'tldv_api_error', detail: (err as Error).message });
    }

    log.info('Fetched meetings from tl;dv', { total: meetings.length });

    // ── Processar cada reunião ────────────────────────────────────────────────
    let synced = 0;
    let alreadySynced = 0;
    let unmatched = 0;
    const unmatchedMeetings: Array<{
      id: string;
      name: string;
      happenedAt: string;
      organizer: { name: string; email: string };
    }> = [];

    for (const meeting of meetings) {
      try {
        const result = await processMeeting(supabase, tldv, meeting, log);

        if (result === 'synced') {
          synced++;
        } else if (result === 'already_synced') {
          alreadySynced++;
        } else {
          unmatched++;
          unmatchedMeetings.push({
            id: meeting.id,
            name: meeting.name,
            happenedAt: meeting.happenedAt,
            organizer: meeting.organizer,
          });
        }
      } catch (err) {
        // Erros por reunião não interrompem o loop
        log.error('Error processing meeting during sync', {
          tldv_id: meeting.id,
          error: (err as Error).message,
        });
        unmatched++;
        unmatchedMeetings.push({
          id: meeting.id,
          name: meeting.name,
          happenedAt: meeting.happenedAt,
          organizer: meeting.organizer,
        });
      }
    }

    log.info('Sync complete', { synced, already_synced: alreadySynced, unmatched });

    return jsonResponse({
      ok: true,
      synced,
      already_synced: alreadySynced,
      unmatched,
      unmatched_meetings: unmatchedMeetings,
    });
  } catch (err) {
    log.error('Unhandled error in tldv-sync', { error: (err as Error).message });
    return jsonResponse({ ok: false, error: 'internal_error' }, 500);
  }
});
