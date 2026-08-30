-- FWUP-02 rollback: remove source column + restore original write policy

BEGIN;

-- Restore original write policy (no source guard)
DROP POLICY IF EXISTS "meet_fup_write" ON public.meetings_followups;

CREATE POLICY "meet_fup_write"
  ON public.meetings_followups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- Drop index
DROP INDEX IF EXISTS public.idx_meetings_followups_source;

-- Drop source column (CHECK constraint is dropped automatically with the column)
ALTER TABLE public.meetings_followups DROP COLUMN IF EXISTS source;

COMMIT;
