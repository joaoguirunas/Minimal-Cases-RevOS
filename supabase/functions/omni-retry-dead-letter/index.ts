/**
 * OMNI PRO™ Dead-Letter Retry — pg_cron Job (every 5 min)
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy omni-retry-dead-letter --no-verify-jwt
 *
 * Picks up dead-letter entries with status='pending' and next_retry_at <= NOW(),
 * resets the original message to status='pending', and lets the delivery engine
 * re-process it on the next tick.
 *
 * Backoff schedule: 1min → 5min → 30min → 2h → 12h (max 5 attempts)
 *
 * Story: OP-04 (Epic OMNI-PRO-V2)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const BATCH_SIZE = 10;
const BACKOFF_SECONDS = [60, 300, 1800, 7200, 43200]; // 1min, 5min, 30min, 2h, 12h

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const log = createLogger('omni-retry-dead-letter');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch pending dead-letter entries ready for retry
    const { data: entries, error: fetchErr } = await supabase
      .from('omni_delivery_dead_letter')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      log.error('fetch_failed', { error: fetchErr.message });
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', retried: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log.info('retrying', { count: entries.length });

    let retried = 0;
    let exhausted = 0;

    for (const entry of entries) {
      const nextAttempt = (entry.attempts as number) + 1;

      if (nextAttempt >= (entry.max_attempts as number)) {
        // Max attempts reached — mark exhausted
        await supabase
          .from('omni_delivery_dead_letter')
          .update({ status: 'exhausted', attempts: nextAttempt })
          .eq('id', entry.id);

        // Mark original message as 'dead' (final state)
        await supabase
          .from('messages')
          .update({ status: 'error', metadata: { ...(entry.metadata ?? {}), dead_letter: true, exhausted_at: new Date().toISOString() } } as Record<string, unknown>)
          .eq('id', entry.message_id);

        log.warn('exhausted', { message_id: entry.message_id, attempts: nextAttempt });
        exhausted++;
        continue;
      }

      // Calculate next backoff
      const backoffIndex = Math.min(nextAttempt, BACKOFF_SECONDS.length - 1);
      const nextRetryAt = new Date(Date.now() + BACKOFF_SECONDS[backoffIndex] * 1000).toISOString();

      // Update dead-letter entry
      await supabase
        .from('omni_delivery_dead_letter')
        .update({
          status: 'pending',
          attempts: nextAttempt,
          next_retry_at: nextRetryAt,
        })
        .eq('id', entry.id);

      // Reset original message to 'pending' so delivery engine picks it up
      await supabase
        .from('messages')
        .update({ status: 'pending' } as Record<string, unknown>)
        .eq('id', entry.message_id)
        .eq('status', 'error'); // guard: only reset if still error

      log.info('message_requeued', {
        message_id: entry.message_id,
        attempt: nextAttempt,
        next_retry_at: nextRetryAt,
      });

      retried++;
    }

    const summary = { status: 'ok', retried, exhausted, total: entries.length };
    log.info('done', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
