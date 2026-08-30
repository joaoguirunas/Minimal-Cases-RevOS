-- Rollback for 20260703120000_email_templates_schema.sql (EMAIL-1.1).
--
-- Drops the FK column first (depends on email_templates), then the table.
-- ON DELETE SET NULL means no follow-up rows are deleted; the column simply disappears.
-- WARNING: destructive. Any follow-up referencing a template loses that reference, and
--   all email_templates rows (incl. seeds) are removed. Take a schema+data snapshot first.
--
-- Apply: supabase db query --linked --file <this> ; then remove the version from schema_migrations.

BEGIN;

ALTER TABLE public.leads_stages_followups
  DROP COLUMN IF EXISTS email_template_id;

DROP TABLE IF EXISTS public.email_templates CASCADE;

COMMIT;
