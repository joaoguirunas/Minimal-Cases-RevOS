-- =============================================================================
-- Migration: Fix RLS Security Issues
-- Priority 1: Enable RLS on 4 tables that have policies but rowsecurity = false
-- Priority 2: Add missing policies to lp_ab_variants (RLS ON but 0 policies)
-- =============================================================================
-- Audit findings:
--   4 tables had RLS DISABLED → their existing policies were silently ignored
--   1 table had RLS ENABLED + 0 policies → all queries returned empty rows
-- =============================================================================

BEGIN;

-- ============================================================
-- PRIORITY 1 — ENABLE ROW LEVEL SECURITY
-- These tables already have policies defined but RLS was off,
-- meaning the policies were never enforced.
-- ============================================================

-- ai_agents_execution_log
-- Existing policy: agents_exec_log_select → SELECT for authenticated USING is_admin_or_gestor()
ALTER TABLE public.ai_agents_execution_log ENABLE ROW LEVEL SECURITY;

-- lp_analytics_daily
-- Existing policy: lp_analytics_daily_select → SELECT for authenticated USING (true)
ALTER TABLE public.lp_analytics_daily ENABLE ROW LEVEL SECURITY;

-- lp_cta_events
-- Existing policies: INSERT for public + SELECT for authenticated (both USING true)
ALTER TABLE public.lp_cta_events ENABLE ROW LEVEL SECURITY;

-- lp_form_submissions
-- Existing policies: INSERT for public + SELECT for authenticated (both USING true)
ALTER TABLE public.lp_form_submissions ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PRIORITY 2 — ADD MISSING POLICIES TO lp_ab_variants
-- Table had RLS ENABLED with 0 policies → nobody could read/write.
-- Follows the same pattern as lp_ab_tests and lp_pages:
--   - Any authenticated user can SELECT
--   - Only admin/manager can INSERT, UPDATE, DELETE
-- ============================================================

CREATE POLICY "lp_ab_variants_select"
  ON public.lp_ab_variants
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lp_ab_variants_insert"
  ON public.lp_ab_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_gestor());

CREATE POLICY "lp_ab_variants_update"
  ON public.lp_ab_variants
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_gestor())
  WITH CHECK (is_admin_or_gestor());

CREATE POLICY "lp_ab_variants_delete"
  ON public.lp_ab_variants
  FOR DELETE
  TO authenticated
  USING (is_admin_or_gestor());

COMMIT;
