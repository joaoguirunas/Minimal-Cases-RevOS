-- =============================================================================
-- Migration: Add missing indexes on all FK columns (42 total)
-- Priority 3: Performance optimization
-- =============================================================================
-- Audit findings:
--   42 FK columns had no index → full table scans on every JOIN/WHERE
--   Worst offenders (high seq_scan counts):
--     - leads (27,645 seq scans) → companies_id, leads_loss_reasons_id unindexed
--     - messages (4,718 seq scans) → users_id, followup_id unindexed
--     - clients_people (10,854 seq scans) → score_*_id columns unindexed
-- =============================================================================
-- NOTE: CREATE INDEX inside a transaction takes a brief lock.
-- Safe for the current dataset size (< 1,000 rows per table).
-- For larger tables in the future, run CONCURRENTLY outside a transaction.
-- =============================================================================

BEGIN;

-- ============================================================
-- clients_people — score system FK columns (used in RLS + joins)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_people_score_framing_id
  ON public.clients_people (score_framing_id);

CREATE INDEX IF NOT EXISTS idx_clients_people_score_investment_id
  ON public.clients_people (score_investment_id);

CREATE INDEX IF NOT EXISTS idx_clients_people_score_objective_id
  ON public.clients_people (score_objective_id);

-- ============================================================
-- clients_people_updates
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_people_updates_user_id
  ON public.clients_people_updates (user_id);

-- ============================================================
-- leads — high-frequency table (27,645 seq scans)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_companies_id
  ON public.leads (companies_id);

CREATE INDEX IF NOT EXISTS idx_leads_loss_reason_id
  ON public.leads (leads_loss_reasons_id);

-- ============================================================
-- leads_notes, leads_files, leads_updates
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_notes_users_id
  ON public.leads_notes (users_id);

CREATE INDEX IF NOT EXISTS idx_leads_files_users_id
  ON public.leads_files (users_id);

CREATE INDEX IF NOT EXISTS idx_leads_updates_users_id
  ON public.leads_updates (users_id);

CREATE INDEX IF NOT EXISTS idx_leads_updates_from_stage_id
  ON public.leads_updates (from_stage_id);

CREATE INDEX IF NOT EXISTS idx_leads_updates_to_stage_id
  ON public.leads_updates (to_stage_id);

-- ============================================================
-- leads_stages_followups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_stages_followups_target_stage_id
  ON public.leads_stages_followups (target_stage_id);

-- ============================================================
-- messages — high-frequency table (4,718 seq scans)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_users_id
  ON public.messages (users_id);

CREATE INDEX IF NOT EXISTS idx_messages_followup_id
  ON public.messages (followup_id);

-- ============================================================
-- meetings
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_meetings_teams_id
  ON public.meetings (teams_id);

-- ============================================================
-- meeting_records, meeting_followup_queue
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_meeting_records_created_by
  ON public.meeting_records (created_by);

CREATE INDEX IF NOT EXISTS idx_meeting_followup_queue_leads_id
  ON public.meeting_followup_queue (leads_id);

-- ============================================================
-- sends, webhooks
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sends_team_id
  ON public.sends (team_id);

CREATE INDEX IF NOT EXISTS idx_webhooks_pipeline_id
  ON public.webhooks (pipeline_id);

-- ============================================================
-- ai_agents
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_agents_leads_stages_id
  ON public.ai_agents (leads_stages_id);

-- ============================================================
-- ai_agents_history
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_agents_history_ai_agent_id
  ON public.ai_agents_history (ai_agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_history_created_by
  ON public.ai_agents_history (created_by);

-- ============================================================
-- ai_agents_score_matrix
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_agents_score_matrix_ai_agent_id
  ON public.ai_agents_score_matrix (ai_agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_score_matrix_score_matrix_id
  ON public.ai_agents_score_matrix (score_matrix_id);

-- ============================================================
-- ai_agents_execution_log
-- Note: has duplicate FK columns lead_id + leads_id both → leads.id
-- Both are indexed here; leads_id will be removed in a future cleanup migration.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_exec_log_ai_agent_id
  ON public.ai_agents_execution_log (ai_agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_exec_log_lead_id
  ON public.ai_agents_execution_log (lead_id);

CREATE INDEX IF NOT EXISTS idx_ai_exec_log_leads_id
  ON public.ai_agents_execution_log (leads_id);

CREATE INDEX IF NOT EXISTS idx_ai_exec_log_created_by
  ON public.ai_agents_execution_log (created_by);

-- ============================================================
-- lp_pages
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lp_pages_form_id
  ON public.lp_pages (form_id);

CREATE INDEX IF NOT EXISTS idx_lp_pages_template_id
  ON public.lp_pages (template_id);

-- ============================================================
-- lp_submissions
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lp_submissions_form_id
  ON public.lp_submissions (form_id);

-- ============================================================
-- lp_ab_tests, lp_ab_sessions, lp_ab_conversions
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lp_ab_tests_created_by
  ON public.lp_ab_tests (created_by);

CREATE INDEX IF NOT EXISTS idx_lp_ab_sessions_variant_id
  ON public.lp_ab_sessions (variant_id);

CREATE INDEX IF NOT EXISTS idx_lp_ab_conversions_session_id
  ON public.lp_ab_conversions (session_id);

-- ============================================================
-- lp_form_submissions
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lp_form_submissions_form_id
  ON public.lp_form_submissions (form_id);

CREATE INDEX IF NOT EXISTS idx_lp_form_submissions_lead_id
  ON public.lp_form_submissions (lead_id);

CREATE INDEX IF NOT EXISTS idx_lp_form_submissions_contact_id
  ON public.lp_form_submissions (contact_id);

-- ============================================================
-- lp_automation_log
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lp_automation_log_submission_id
  ON public.lp_automation_log (submission_id);

-- ============================================================
-- call_pro_calls
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_call_pro_calls_lead_id
  ON public.call_pro_calls (lead_id);

-- ============================================================
-- followup_queue — 4 FK columns all unindexed
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_followup_queue_followup_id
  ON public.followup_queue (followup_id);

CREATE INDEX IF NOT EXISTS idx_followup_queue_meeting_followup_id
  ON public.followup_queue (meeting_followup_id);

CREATE INDEX IF NOT EXISTS idx_followup_queue_message_id
  ON public.followup_queue (message_id);

CREATE INDEX IF NOT EXISTS idx_followup_queue_pessoa_id
  ON public.followup_queue (pessoa_id);

COMMIT;
