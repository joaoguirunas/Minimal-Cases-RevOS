-- Rollback: restore blanket "authenticated_write" policy on public.settings,
-- removing the split policies and the role-guard helper function introduced
-- by 20260426003000_settings_bi_voice_beta_role_guard.sql

BEGIN;

DROP POLICY IF EXISTS "settings_update_with_bi_voice_guard" ON public.settings;
DROP POLICY IF EXISTS "settings_insert" ON public.settings;
DROP POLICY IF EXISTS "settings_delete" ON public.settings;
DROP FUNCTION IF EXISTS public.check_bi_voice_beta_update();

CREATE POLICY "authenticated_write" ON public.settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
