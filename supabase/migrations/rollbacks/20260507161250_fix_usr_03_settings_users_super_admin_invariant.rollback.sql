-- ═══════════════════════════════════════════════════════════════════
-- Rollback: 20260507161250_fix_usr_03_settings_users_super_admin_invariant.sql
-- Remove trigger + função. Backfill de dados não é revertido (idempotente).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS trg_settings_users_sync_admin_flag ON public.settings_users;
DROP FUNCTION IF EXISTS public.settings_users_sync_admin_flag();

COMMIT;
