-- Fix message duplication: atomic claim for omni-delivery-engine
--
-- Root cause: race condition between direct trigger (from ai-agent-execute)
-- and pg_cron (every minute). Both SELECT the same pending messages simultaneously,
-- causing duplicate delivery to WhatsApp/Instagram.
--
-- Fix: Add 'sending' intermediate status + atomic claim RPC using FOR UPDATE SKIP LOCKED.
-- Migration: 20260316210000

BEGIN;

-- ── 1. Expand CHECK constraint to include 'sending' ────────────────────────────

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;

ALTER TABLE public.messages ADD CONSTRAINT messages_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'sending'::text,
    'sent'::text,
    'delivered'::text,
    'read'::text,
    'error'::text
  ]));

-- ── 2. Atomic claim function ────────────────────────────────────────────────────
-- Uses FOR UPDATE SKIP LOCKED so concurrent invocations never claim the same rows.
-- Returns claimed messages (already transitioned to 'sending').

CREATE OR REPLACE FUNCTION claim_pending_messages(
  p_batch_size    int  DEFAULT 20,
  p_max_age_hours int  DEFAULT 24,
  p_people_id     uuid DEFAULT NULL,
  p_channel       text DEFAULT NULL
)
RETURNS TABLE (
  id                   bigint,
  channel              text,
  content              text,
  message_type         text,
  media_url            text,
  media_metadata       jsonb,
  people_id            uuid,
  lead_id              uuid,
  user_id              uuid,
  source_type          text,
  module_ref_id        text,
  whatsapp_template_id text,
  wa_phone_number_id   text,
  execution_id         uuid,
  metadata             jsonb,
  sent_at              timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE messages m_upd
    SET status = 'sending'
    WHERE m_upd.id IN (
      SELECT m.id
      FROM messages m
      WHERE m.status = 'pending'
        AND m.from_contact != 'cliente'
        AND m.created_at > now() - (p_max_age_hours || ' hours')::interval
        AND (p_people_id IS NULL OR m.people_id = p_people_id)
        AND (p_channel IS NULL OR m.channel = p_channel)
        -- Respect delay_minutes: only claim messages whose delay has elapsed
        AND (
          (m.metadata->>'delay_minutes') IS NULL
          OR (m.metadata->>'delay_minutes')::int = 0
          OR (
            COALESCE(m.sent_at, m.created_at)
            + ((m.metadata->>'delay_minutes')::int * interval '1 minute')
            <= now()
          )
        )
      ORDER BY m.id ASC
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      m_upd.id,
      m_upd.channel,
      m_upd.content,
      m_upd.message_type,
      m_upd.media_url,
      m_upd.media_metadata,
      m_upd.people_id,
      m_upd.lead_id,
      m_upd.user_id,
      m_upd.source_type,
      m_upd.module_ref_id,
      m_upd.whatsapp_template_id,
      m_upd.wa_phone_number_id,
      m_upd.execution_id,
      m_upd.metadata,
      m_upd.sent_at
  )
  SELECT * FROM claimed ORDER BY claimed.id ASC;
END;
$$;

COMMENT ON FUNCTION claim_pending_messages IS
  'Atomically claims pending outbound messages by setting status=sending. '
  'Uses FOR UPDATE SKIP LOCKED to prevent duplicate delivery when multiple '
  'omni-delivery-engine instances run concurrently (direct trigger + pg_cron).';

-- ── 3. Safety: reset stale 'sending' messages back to 'pending' ─────────────────
-- If omni-delivery-engine crashes mid-processing, messages stuck in 'sending'
-- for >5 minutes are reset. Runs via pg_cron every 5 minutes.

CREATE OR REPLACE FUNCTION reset_stale_sending_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE messages
  SET status = 'pending'
  WHERE status = 'sending'
    AND created_at < now() - interval '5 minutes';
END;
$$;

-- Schedule stale sending reset every 5 minutes
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'reset-stale-sending';

SELECT cron.schedule(
  'reset-stale-sending',
  '*/5 * * * *',
  $$ SELECT reset_stale_sending_messages(); $$
);

-- ── 4. Update pg_cron trigger to also check for 'sending' stuck messages ────────
-- (The existing trigger_omni_delivery_engine only checks for 'pending')

COMMIT;
