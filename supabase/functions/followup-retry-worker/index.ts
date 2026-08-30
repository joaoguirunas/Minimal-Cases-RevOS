/**
 * CALL PRO™ — Followup Queue Retry Worker
 *
 * DEPLOY: supabase functions deploy followup-retry-worker --no-verify-jwt
 *
 * Called by pg_cron every 10 minutes.
 * Finds followup_queue entries stuck in 'queued' for > 15 min (N8N callback never arrived)
 * and re-dispatches them via followup-trigger-worker.
 * After 3 retries: marks status='failed' and writes to adm_audit_log.
 *
 * Story: FWUP-06
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const MAX_RETRIES = 3;
const STALE_MINUTES = 15;
const BATCH_SIZE = 50;

Deno.serve(async (_req: Request) => {
  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const log            = createLogger('followup-retry-worker');
  const supabase       = createClient(supabaseUrl, serviceRoleKey);

  const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  try {
    // Fetch stale queued entries eligible for retry
    const { data: entries, error: fetchErr } = await supabase
      .from('followup_queue')
      .select('id, lead_id, canal, retry_count, followup_id, meeting_followup_id, source_type')
      .eq('status', 'queued')
      .lt('updated_at', staleThreshold)
      .lt('retry_count', MAX_RETRIES)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      log.error('fetch_failed', { error: fetchErr.message });
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', retried: 0, failed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log.info('processing_stale_entries', { count: entries.length });

    let retried = 0;
    let failed  = 0;

    for (const entry of entries) {
      const newRetryCount = (entry.retry_count as number) + 1;
      const isExhausted   = newRetryCount >= MAX_RETRIES;

      if (isExhausted) {
        // Dead-letter: mark failed and write audit event
        const errorMsg = `Followup abandonado após ${MAX_RETRIES} tentativas sem callback do N8N`;

        await supabase
          .from('followup_queue')
          .update({
            status:        'failed',
            retry_count:   newRetryCount,
            updated_at:    new Date().toISOString(),
            response_data: { error: errorMsg, exhausted_at: new Date().toISOString() },
            error_message: errorMsg,
          })
          .eq('id', entry.id);

        // Audit log — use adm_audit_log (control-plane scope for this worker)
        await supabase
          .from('adm_audit_log')
          .insert({
            action:     'followup_queue.dead_letter',
            entity:     'followup_queue',
            entity_id:  entry.id,
            details:    {
              lead_id:             entry.lead_id,
              canal:               entry.canal,
              retry_count:         newRetryCount,
              followup_id:         entry.followup_id,
              meeting_followup_id: entry.meeting_followup_id,
              source_type:         entry.source_type,
              reason:              errorMsg,
            },
          });

        log.warn('entry_exhausted', { entry_id: entry.id, lead_id: entry.lead_id, retry_count: newRetryCount });
        failed++;
        continue;
      }

      // Reset to pending so followup-trigger-worker picks it up on next tick
      await supabase
        .from('followup_queue')
        .update({
          status:      'pending',
          retry_count: newRetryCount,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', entry.id)
        .eq('status', 'queued'); // guard: only reset if still queued

      log.info('entry_requeued', { entry_id: entry.id, lead_id: entry.lead_id, retry_count: newRetryCount });
      retried++;
    }

    // Trigger followup-trigger-worker to pick up requeued entries immediately
    if (retried > 0) {
      try {
        await supabase.functions.invoke('followup-trigger-worker', {
          body: { source: 'retry-worker' },
        });
        log.info('trigger_worker_invoked', { requeued: retried });
      } catch (invokeErr) {
        // Non-fatal: cron will pick up on next tick anyway
        log.error('trigger_worker_invoke_failed', {
          error: invokeErr instanceof Error ? invokeErr.message : String(invokeErr),
        });
      }
    }

    const summary = { status: 'ok', retried, failed, total: entries.length };
    log.info('done', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('unhandled', { error: errMsg });
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
