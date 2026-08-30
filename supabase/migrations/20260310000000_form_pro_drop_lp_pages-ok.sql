-- ============================================================
-- FORM PRO™ — Remove LP PRO page infrastructure
-- Drops all page-related tables; renames form tables
-- Date: 2026-03-10
--
-- Tables analysis:
--   lp_submissions      = CRM-facing (UTM, ip, lead_id) — RENAME → form_pro_submissions
--   lp_form_submissions = Page tracking (session_id, visitor_id) — DROP
--   lp_forms            = Form definitions — RENAME → form_pro_forms
-- ============================================================

-- ─── 1. DROP page-only tables (order matters: FK deps first) ───

-- A/B testing
DROP TABLE IF EXISTS lp_ab_conversions CASCADE;
DROP TABLE IF EXISTS lp_ab_sessions CASCADE;
DROP TABLE IF EXISTS lp_ab_variants CASCADE;
DROP TABLE IF EXISTS lp_ab_tests CASCADE;

-- Automation
DROP TABLE IF EXISTS lp_automation_log CASCADE;
DROP TABLE IF EXISTS lp_automation_rules CASCADE;

-- Analytics
DROP TABLE IF EXISTS lp_page_analytics CASCADE;
DROP TABLE IF EXISTS lp_analytics_events CASCADE;

-- Page-tracking submissions (session_id/visitor_id based — NOT the CRM table)
DROP TABLE IF EXISTS lp_form_submissions CASCADE;

-- Templates
DROP TABLE IF EXISTS lp_templates CASCADE;

-- Pages (last — other tables cascaded)
DROP TABLE IF EXISTS lp_pages CASCADE;

-- ─── 2. Rename lp_submissions → form_pro_submissions ───
-- This is the CRM-facing table used by lp-submit edge function
-- page_id is already nullable (migration 20260308130000)
ALTER TABLE IF EXISTS lp_submissions RENAME TO form_pro_submissions;

-- ─── 3. Rename lp_forms → form_pro_forms ───
ALTER TABLE IF EXISTS lp_forms RENAME TO form_pro_forms;

-- ─── Done ───
-- Summary:
--   DROPPED: lp_pages, lp_templates, lp_form_submissions, lp_analytics_events,
--            lp_page_analytics, lp_automation_rules, lp_automation_log,
--            lp_ab_tests, lp_ab_variants, lp_ab_sessions, lp_ab_conversions
--   RENAMED: lp_forms → form_pro_forms
--            lp_submissions → form_pro_submissions
