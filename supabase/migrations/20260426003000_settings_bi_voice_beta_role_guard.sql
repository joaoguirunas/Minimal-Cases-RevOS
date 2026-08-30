-- BI-VOICE-04 AC6: Restrict UPDATE of bi_voice_chat_beta_enabled to gestor/super_adm.
--
-- Context: public.settings has a blanket "authenticated_write" FOR ALL USING (true) policy.
-- Postgres RLS is row-level — column-level restriction requires a SECURITY DEFINER helper
-- that validates caller role before allowing the guarded field to be toggled.
--
-- Strategy: drop the blanket write policy and replace it with:
--   1) INSERT (unrestricted for authenticated)
--   2) UPDATE with WITH CHECK that guards bi_voice_chat_beta_enabled changes
--   3) DELETE (unrestricted for authenticated)
-- All other settings UPDATE paths are unaffected.

BEGIN;

CREATE OR REPLACE FUNCTION public.check_bi_voice_beta_update()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_gestor boolean;
BEGIN
  SELECT (user_type IN ('gestor') OR super_admin = true)
    INTO v_is_gestor
    FROM public.settings_users
   WHERE auth_user_id = auth.uid()
     AND active = true
   LIMIT 1;

  RETURN COALESCE(v_is_gestor, false);
END;
$$;

-- Drop the blanket write policy that allows any authenticated user to UPDATE anything
DROP POLICY IF EXISTS "authenticated_write" ON public.settings;

-- INSERT: unrestricted for authenticated (same as before)
DROP POLICY IF EXISTS "settings_insert" ON public.settings;
CREATE POLICY "settings_insert" ON public.settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: allow freely, EXCEPT when bi_voice_chat_beta_enabled is changed — require gestor
DROP POLICY IF EXISTS "settings_update_with_bi_voice_guard" ON public.settings;
CREATE POLICY "settings_update_with_bi_voice_guard" ON public.settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    (bi_voice_chat_beta_enabled IS NOT DISTINCT FROM
      (SELECT s.bi_voice_chat_beta_enabled FROM public.settings s WHERE s.id = settings.id LIMIT 1))
    OR
    public.check_bi_voice_beta_update()
  );

-- DELETE: unrestricted for authenticated (same as before)
DROP POLICY IF EXISTS "settings_delete" ON public.settings;
CREATE POLICY "settings_delete" ON public.settings
  FOR DELETE
  TO authenticated
  USING (true);

COMMIT;
