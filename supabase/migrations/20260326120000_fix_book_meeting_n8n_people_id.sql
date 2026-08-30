-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: book_meeting N8N MCP overload — resolve people_id + fix column names
--
-- The N8N overload (p_lead_id, p_user_id, p_title, p_start_ts, p_duration_minutes, p_notes)
-- had two bugs:
--   1. Inserted into non-existent columns: date, start_time (TIME), end_time (TIME)
--      → meetings table uses start_time (TIMESTAMPTZ), end_time (TIMESTAMPTZ)
--   2. Did NOT populate people_id from the lead
--
-- This migration fixes both issues to match the public booking overload fix
-- from 20260326110000.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.book_meeting(
  p_lead_id          UUID,
  p_user_id          UUID,
  p_title            TEXT,
  p_start_ts         TIMESTAMPTZ,
  p_duration_minutes INT  DEFAULT 30,
  p_notes            TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_id UUID;
  v_people_id  UUID;
  v_end_ts     TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'book_meeting: lead % not found', p_lead_id;
  END IF;

  -- Resolve people_id from lead
  SELECT people_id INTO v_people_id FROM public.leads WHERE id = p_lead_id;

  -- Calculate end time
  v_end_ts := p_start_ts + (p_duration_minutes || ' minutes')::INTERVAL;

  INSERT INTO public.meetings (
    lead_id, people_id, user_id, title, start_time, end_time, notes, status, source
  )
  VALUES (
    p_lead_id, v_people_id, p_user_id, p_title,
    p_start_ts, v_end_ts,
    p_notes,
    'agendado',
    'ai_agent'
  )
  RETURNING id INTO v_meeting_id;

  RETURN v_meeting_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TEXT, TIMESTAMPTZ, INT, TEXT)
  TO authenticated, service_role;
