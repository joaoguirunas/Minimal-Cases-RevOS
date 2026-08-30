-- Fix: meet_fup_write WITH CHECK had a self-referential subquery bug
-- Original WITH CHECK queried meetings_followups from within its own policy → infinite recursion (42P17)
-- and/or returned all rows → "more than one row returned by a subquery" on every UPDATE.
-- Fix: remove the source subquery entirely. The source column is enforced by:
--   1. CHECK constraint (source IN ('webhook','channel'))
--   2. Frontend never sends source in the UPDATE payload

DROP POLICY IF EXISTS meet_fup_write ON public.meetings_followups;

CREATE POLICY meet_fup_write ON public.meetings_followups
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = ANY (ARRAY['admin'::text, 'manager'::text]))
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = ANY (ARRAY['admin'::text, 'manager'::text]))
        AND active = true
        AND deleted_at IS NULL
    )
  );
