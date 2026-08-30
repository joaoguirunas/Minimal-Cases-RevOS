-- Fix claim_pending_messages RPC: module_ref_id type mismatch (text → uuid)
-- The messages.module_ref_id column is uuid, not text.
-- Migration: 20260317000000

DROP FUNCTION IF EXISTS claim_pending_messages(int, int, uuid, text);

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
  module_ref_id        uuid,
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
