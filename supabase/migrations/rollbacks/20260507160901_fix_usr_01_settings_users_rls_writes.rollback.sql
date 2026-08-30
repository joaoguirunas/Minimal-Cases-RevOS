-- ═══════════════════════════════════════════════════════════════════
-- Rollback: 20260507160901_fix_usr_01_settings_users_rls_writes.sql
-- Restaura policies abertas FWUP-17 e remove função is_admin().
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "settings_users_select_authenticated"   ON public.settings_users;
DROP POLICY IF EXISTS "settings_users_insert_admin_only"      ON public.settings_users;
DROP POLICY IF EXISTS "settings_users_update_owner_or_admin"  ON public.settings_users;
DROP POLICY IF EXISTS "settings_users_delete_admin_only"      ON public.settings_users;

CREATE POLICY "authenticated_read"  ON public.settings_users FOR SELECT USING (true);
CREATE POLICY "authenticated_write" ON public.settings_users FOR ALL    USING (true) WITH CHECK (true);

DROP FUNCTION IF EXISTS public.is_admin();

COMMIT;
