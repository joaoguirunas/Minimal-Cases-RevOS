-- =============================================================================
-- CLEAN-CRM-01: Round-robin lead assignment RPC
-- Assigns a lead to the team member who received a lead least recently.
-- =============================================================================

-- ── RPC: assign_lead_round_robin ─────────────────────────────────────────────
-- Parameters:
--   p_lead_id  — the lead to assign
--   p_team_id  — the team to distribute within
-- Returns: uuid of the assigned user_id (or NULL if team has no active members)
--
-- Algorithm: among active members of p_team_id, pick the one whose most recent
-- lead assignment (leads.created_at WHERE user_id = member) is the oldest.
-- If a member has no leads at all, they are treated as assigned at epoch (highest priority).
CREATE OR REPLACE FUNCTION public.assign_lead_round_robin(
  p_lead_id uuid,
  p_team_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Pick the active team member with the oldest most-recent lead assignment
  SELECT sut.user_id
    INTO v_user_id
    FROM settings_users_teams sut
    JOIN settings_users su ON su.id = sut.user_id
   WHERE sut.team_id = p_team_id
     AND su.active = true
   ORDER BY (
     SELECT MAX(l.created_at)
       FROM leads l
      WHERE l.user_id = sut.user_id
   ) ASC NULLS FIRST
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assign the lead
  UPDATE public.leads
     SET user_id   = v_user_id,
         teams_id  = p_team_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION public.assign_lead_round_robin(uuid, uuid) IS
  'Assigns lead p_lead_id to the active member of p_team_id who received a lead '
  'least recently (round-robin by last lead created_at). Returns assigned user_id.';

GRANT EXECUTE ON FUNCTION public.assign_lead_round_robin(uuid, uuid) TO authenticated;
