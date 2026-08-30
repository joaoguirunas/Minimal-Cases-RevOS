-- ═══════════════════════════════════════════════════════════════════
-- 20260507161250_fix_usr_03_settings_users_super_admin_invariant.sql
-- FIX-USR-03: Trigger garantindo invariante super_admin ↔ user_type='admin'.
--
-- Problema:
--   Sem trigger, é possível existir row com super_admin=true E user_type≠'admin',
--   ou super_admin=false E user_type='admin'. Ambos causam drift entre frontend
--   (que deriva super_adm de user_type) e edge functions (que checam super_admin).
--
-- Solução (sync-on-write):
--   - Se super_admin=true e user_type≠'admin' → força user_type='admin'
--   - Se user_type='admin' e super_admin IS NOT TRUE → força super_admin=true
--   - Demais combinações passam intactas
--   Trigger BEFORE INSERT OR UPDATE; idempotente via DROP IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Função do trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settings_users_sync_admin_flag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.super_admin = true AND (NEW.user_type IS DISTINCT FROM 'admin') THEN
    NEW.user_type := 'admin';
  ELSIF NEW.user_type = 'admin' AND (NEW.super_admin IS NOT TRUE) THEN
    NEW.super_admin := true;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 2. Backfill: corrigir rows que violam o invariante ─────────────
-- Caso A: super_admin=true e user_type≠'admin' → user_type='admin'
UPDATE public.settings_users
   SET user_type = 'admin'
 WHERE super_admin = true
   AND user_type IS DISTINCT FROM 'admin';

-- Caso B: user_type='admin' e super_admin IS NOT TRUE → super_admin=true
UPDATE public.settings_users
   SET super_admin = true
 WHERE user_type = 'admin'
   AND super_admin IS NOT TRUE;

-- ── 3. Trigger BEFORE INSERT OR UPDATE ─────────────────────────────
DROP TRIGGER IF EXISTS trg_settings_users_sync_admin_flag ON public.settings_users;
CREATE TRIGGER trg_settings_users_sync_admin_flag
  BEFORE INSERT OR UPDATE OF super_admin, user_type
  ON public.settings_users
  FOR EACH ROW
  EXECUTE FUNCTION public.settings_users_sync_admin_flag();

COMMIT;
