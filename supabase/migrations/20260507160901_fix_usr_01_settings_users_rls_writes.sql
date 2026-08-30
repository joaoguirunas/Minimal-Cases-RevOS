-- ═══════════════════════════════════════════════════════════════════
-- 20260507160901_fix_usr_01_settings_users_rls_writes.sql
-- FIX-USR-01: Restaura RLS restritivo em writes de settings_users.
--
-- Problema:
--   FWUP-17 (20260428060000) reabriu intencionalmente settings_users com
--   authenticated_write USING (true) para evitar quebra em tenants novos.
--   Isso permite auto-promoção: qualquer usuário autenticado pode rodar
--   UPDATE settings_users SET user_type='admin' via anon-key.
--
-- Solução:
--   - SELECT permanece aberto (UI precisa listar usuários)
--   - INSERT: somente admin (super_admin OR user_type='admin')
--   - UPDATE: dono da linha (auth.uid() = auth_user_id) OU admin
--   - DELETE: somente admin
--   - Função is_admin_or_manager() já existe; criamos is_admin() para distinguir
--
-- Idempotente via DROP IF EXISTS antes de cada CREATE.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Função auxiliar is_admin() ───────────────────────────────────
-- Mais restritiva que is_admin_or_manager(): exige admin (não aceita manager).
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'admin')
      AND active = true
      AND deleted_at IS NULL
  )
$function$;

-- ── 2. Drop policies abertas legadas ────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read"  ON public.settings_users;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_users;
DROP POLICY IF EXISTS "users_select_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_update_policy" ON public.settings_users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.settings_users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.settings_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.settings_users;
DROP POLICY IF EXISTS "Admins can create users" ON public.settings_users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.settings_users;

-- ── 3. SELECT aberto (mantém UX de listas de usuários) ──────────────
CREATE POLICY "settings_users_select_authenticated"
  ON public.settings_users
  FOR SELECT
  TO authenticated
  USING (true);

-- ── 4. INSERT: somente admin ────────────────────────────────────────
CREATE POLICY "settings_users_insert_admin_only"
  ON public.settings_users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ── 5. UPDATE: dono da linha (sem alterar role/status) OU admin ─────
-- Notas:
--   - Postgres avalia USING para a linha existente (pré-update)
--     e WITH CHECK para o estado pós-update.
--   - Bloqueio de auto-promoção: dono pode atualizar a linha, mas
--     se tentar mudar user_type/super_admin/active/deleted_at,
--     o WITH CHECK exige is_admin(). Como is_admin() consulta a tabela
--     (SECURITY DEFINER), funciona sem recursão.
CREATE POLICY "settings_users_update_owner_or_admin"
  ON public.settings_users
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR auth_user_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR (
      auth_user_id = auth.uid()
      -- Owner não pode alterar campos sensíveis em si próprio.
      -- A comparação contra OLD não é possível em WITH CHECK; em vez disso,
      -- delegamos a proteção a um trigger BEFORE UPDATE (FIX-USR-03 cuida).
      -- Aqui apenas garantimos que owner não pode setar super_admin=true
      -- nem user_type='admin' (escala de privilégio direta).
      AND super_admin IS NOT TRUE
      AND user_type IS DISTINCT FROM 'admin'
    )
  );

-- ── 6. DELETE: somente admin ────────────────────────────────────────
CREATE POLICY "settings_users_delete_admin_only"
  ON public.settings_users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;
