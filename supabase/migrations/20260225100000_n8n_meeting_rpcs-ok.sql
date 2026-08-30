-- ═══════════════════════════════════════════════════════════════════════════════════
-- N8N MCP Tools — Meeting RPCs
-- Expose book_meeting + update_meeting for the AI scheduling agent
-- Used by N8N via MCP trigger (service_role key)
-- ═══════════════════════════════════════════════════════════════════════════════════

-- ─── book_meeting ─────────────────────────────────────────────────────────────────
-- Creates a meeting from the AI agent.
-- p_lead_id: the lead this meeting belongs to
-- p_user_id: the responsible seller (settings_users.id)
-- p_title: meeting title/subject
-- p_start_ts: ISO 8601 timestamp for meeting start (e.g. "2026-03-10T14:00:00")
-- p_duration_minutes: meeting duration (default 30)
-- p_notes: optional notes/context
-- Returns: the new meeting id
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
  v_date       DATE;
  v_start_time TIME;
  v_end_time   TIME;
BEGIN
  -- Validate lead exists
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'book_meeting: lead % not found', p_lead_id;
  END IF;

  -- Parse timestamp into date + time parts
  v_date       := p_start_ts::DATE;
  v_start_time := p_start_ts::TIME;
  v_end_time   := (p_start_ts + (p_duration_minutes || ' minutes')::INTERVAL)::TIME;

  INSERT INTO public.meetings (
    leads_id, users_id, date, start_time, end_time, notes, status, source
  )
  VALUES (
    p_lead_id, p_user_id, v_date, v_start_time, v_end_time,
    COALESCE(p_title || E'\n\n' || p_notes, p_title),
    'agendado',
    'ai_agent'
  )
  RETURNING id INTO v_meeting_id;

  RETURN v_meeting_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_meeting(UUID, UUID, TEXT, TIMESTAMPTZ, INT, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.book_meeting IS
  'N8N MCP: Creates a meeting from AI agent. Returns new meeting UUID.';


-- ─── update_meeting ───────────────────────────────────────────────────────────────
-- Updates an existing meeting status, time, or notes.
-- p_meeting_id: UUID of the meeting to update
-- p_status: new status (e.g. "cancelada", "reagendada", "realizada")
-- p_start_ts: new start timestamp (required when p_status = "reagendada")
-- p_duration_minutes: new duration (used with p_start_ts)
-- p_notes: additional notes about the change
CREATE OR REPLACE FUNCTION public.update_meeting(
  p_meeting_id       UUID,
  p_status           TEXT,
  p_start_ts         TIMESTAMPTZ DEFAULT NULL,
  p_duration_minutes INT         DEFAULT NULL,
  p_notes            TEXT        DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date       DATE;
  v_start_time TIME;
  v_end_time   TIME;
BEGIN
  -- Validate meeting exists
  IF NOT EXISTS (SELECT 1 FROM public.meetings WHERE id = p_meeting_id) THEN
    RAISE EXCEPTION 'update_meeting: meeting % not found', p_meeting_id;
  END IF;

  IF p_start_ts IS NOT NULL THEN
    v_date       := p_start_ts::DATE;
    v_start_time := p_start_ts::TIME;
    v_end_time   := (p_start_ts + (COALESCE(p_duration_minutes, 30) || ' minutes')::INTERVAL)::TIME;

    UPDATE public.meetings
    SET
      status     = p_status,
      date       = v_date,
      start_time = v_start_time,
      end_time   = v_end_time,
      notes      = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END
    WHERE id = p_meeting_id;
  ELSE
    UPDATE public.meetings
    SET
      status = p_status,
      notes  = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_notes ELSE notes END
    WHERE id = p_meeting_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_meeting(UUID, TEXT, TIMESTAMPTZ, INT, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.update_meeting IS
  'N8N MCP: Updates meeting status, time, or notes from AI agent.';
