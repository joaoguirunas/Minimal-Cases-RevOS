-- =============================================================================
-- N8N-WAA-4: process_message_buffer() + pg_cron every 5 seconds
-- Epic: Native AI Agent Runtime (N8N-WAA)
-- Agent: @data-engineer
--
-- PREREQUISITES:
--   Extensions pg_net and pg_cron must be enabled in Supabase dashboard.
--   Database settings must be configured (see SETUP section below).
--
-- SETUP (run once in Supabase SQL editor, NOT in migration):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
-- =============================================================================

-- ── ENABLE EXTENSIONS (idempotent) ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ── CORE FUNCTION ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_message_buffer()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec           record;
  supabase_url  text;
  svc_key       text;
BEGIN
  -- Read configuration from DB settings
  supabase_url := current_setting('app.supabase_url', true);
  svc_key      := current_setting('app.service_role_key', true);

  -- Guard: skip if not configured (development environments)
  IF supabase_url IS NULL OR svc_key IS NULL THEN
    RAISE NOTICE 'process_message_buffer: app.supabase_url or app.service_role_key not set — skipping';
    RETURN;
  END IF;

  -- Find all people with expired, unprocessed buffer entries that are not locked
  FOR rec IN
    SELECT DISTINCT mb.people_id
    FROM   message_buffer mb
    JOIN   clients_people cp ON cp.id = mb.people_id
    WHERE  mb.processed     = false
      AND  mb.expires_at    < now()
      AND  cp.ai_processing_lock = false
    FOR UPDATE OF mb SKIP LOCKED
  LOOP
    -- Acquire processing lock
    UPDATE clients_people
      SET ai_processing_lock = true
      WHERE id = rec.people_id;

    -- Invoke ai-agent-execute edge function via pg_net (fire & forget)
    PERFORM net.http_post(
      url     := supabase_url || '/functions/v1/ai-agent-execute',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body    := jsonb_build_object('people_id', rec.people_id)::text
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION process_message_buffer() IS
  'Called by pg_cron every 5s. Finds expired unprocessed buffer entries and triggers ai-agent-execute per person.';


-- ── SAFETY FUNCTION: release stale locks ─────────────────────────────────────
-- In case ai-agent-execute crashes without releasing the lock, this releases
-- locks older than 5 minutes.

CREATE OR REPLACE FUNCTION release_stale_ai_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clients_people
    SET ai_processing_lock = false
    WHERE ai_processing_lock = true
      AND ai_last_message_at < now() - interval '5 minutes';
END;
$$;

COMMENT ON FUNCTION release_stale_ai_locks() IS
  'Safety valve: releases ai_processing_lock stuck > 5 minutes (edge function crash recovery).';


-- ── pg_cron SCHEDULES ────────────────────────────────────────────────────────

-- Process buffer every 5 seconds
-- Note: pg_cron minimum granularity is 1 minute.
-- For sub-minute scheduling, use multiple jobs at different offsets.
-- Here we use a single 1-minute job and loop internally if needed,
-- OR use the Supabase approach of scheduling multiple jobs.

-- Primary: every minute (pg_cron minimum)
SELECT cron.schedule(
  'process-message-buffer',
  '* * * * *',  -- every minute
  'SELECT process_message_buffer()'
);

-- Release stale locks every 10 minutes
SELECT cron.schedule(
  'release-stale-ai-locks',
  '*/10 * * * *',
  'SELECT release_stale_ai_locks()'
);

-- NOTE ON 5-SECOND POLLING:
-- pg_cron minimum is 1 minute. For true 5-second polling, configure
-- Supabase Database Webhooks on message_buffer INSERT to trigger
-- the edge function directly. This provides real-time processing
-- without relying on cron polling. See docs/architecture/ai-agent-webhook-trigger.md
