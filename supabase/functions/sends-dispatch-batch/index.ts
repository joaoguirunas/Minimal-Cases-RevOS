import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Called by pg_cron every minute via service role.
// Finds all sends with status='running' where the next batch is due, then
// invokes send-dispatch-worker for each one. Cadence is enforced by
// comparing last_batch_at + send_interval_seconds against now().
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('sends-dispatch-batch');
  const start = Date.now();
  log.info('start');

  try {
    // Auth: accept service role key (pg_cron path) or Bearer JWT (manual test path)
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all running sends where next batch is due
    const { data: runningSends, error: sendsErr } = await supabase
      .from('sends')
      .select('id, send_interval_seconds, last_batch_at')
      .eq('status', 'running');

    if (sendsErr) {
      throw new Error(`Failed to fetch running sends: ${sendsErr.message}`);
    }

    if (!runningSends || runningSends.length === 0) {
      log.info('no running sends');
      return new Response(
        JSON.stringify({ success: true, dispatched: 0, skipped: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = Date.now();
    let dispatched = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const send of runningSends) {
      const intervalMs = (send.send_interval_seconds ?? 60) * 1000;
      const lastBatchAt = send.last_batch_at ? new Date(send.last_batch_at).getTime() : 0;
      const nextBatchDue = lastBatchAt + intervalMs;

      if (now < nextBatchDue) {
        skipped++;
        log.debug('skip — not due yet', { send_id: send.id, due_in_ms: nextBatchDue - now });
        continue;
      }

      // Mark last_batch_at immediately to prevent double-dispatch from concurrent cron ticks.
      // Compare-and-swap on the OLD last_batch_at value (not just status='running'): if this
      // invocation is racing another one for the same send (an overlapping cron tick, e.g. a
      // slow previous run still in flight when the next minute fires), only the one whose
      // WHERE still matches the value it read wins — the loser's update affects zero rows and
      // it skips invoking the worker at all, instead of both calling it for the same batch.
      let casQuery = supabase
        .from('sends')
        .update({ last_batch_at: new Date().toISOString() })
        .eq('id', send.id)
        .eq('status', 'running');
      casQuery = send.last_batch_at
        ? casQuery.eq('last_batch_at', send.last_batch_at)
        : casQuery.is('last_batch_at', null);
      const { data: casRows, error: updateErr } = await casQuery.select('id');

      if (updateErr) {
        log.warn('could not update last_batch_at', { send_id: send.id, error: updateErr.message });
        skipped++;
        continue;
      }
      if (!casRows || casRows.length === 0) {
        log.info('lost race to a concurrent tick, skipping', { send_id: send.id });
        skipped++;
        continue;
      }

      // Invoke send-dispatch-worker with service role key
      try {
        const workerRes = await fetch(`${supabaseUrl}/functions/v1/send-dispatch-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ send_id: send.id, batch_size: 1 }),
          signal: AbortSignal.timeout(55000), // stay within 1-min cron window
        });

        const workerData = await workerRes.json().catch(() => ({}));

        if (!workerRes.ok || !workerData.success) {
          const msg = workerData.error ?? `HTTP ${workerRes.status}`;
          log.warn('worker returned error', { send_id: send.id, error: msg });
          errors.push(`${send.id}: ${msg}`);
        } else {
          dispatched++;
          log.info('batch dispatched', {
            send_id: send.id,
            processed: workerData.processed,
            has_more: workerData.has_more,
          });

          // If worker says no more pending contacts, mark send as completed
          if (!workerData.has_more) {
            await supabase
              .from('sends')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', send.id)
              .eq('status', 'running');
            log.info('send completed', { send_id: send.id });
          }
        }
      } catch (fetchErr) {
        const msg = (fetchErr as Error).message;
        log.error('worker fetch failed', { send_id: send.id, error: msg });
        errors.push(`${send.id}: ${msg}`);
      }
    }

    log.info('done', { dispatched, skipped, errors: errors.length, elapsed_ms: log.elapsed(start) });

    return new Response(
      JSON.stringify({
        success: true,
        dispatched,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('fatal', { error: errMsg });
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
