-- ═══════════════════════════════════════════════════════════════════════════════════
-- CALL PRO™ — RLS Fix + Online Status
-- P1.1: Isolar call_pro_calls por user_id (era USING (true) → permissivo demais)
-- P1.2: Adicionar is_online em call_pro_operator_mappings
-- P1.x: Adicionar RLS faltante em settings, categories, operator_mappings
-- Tabela de permissões: settings_users (auth_user_id, super_admin, user_type, active)
-- ═══════════════════════════════════════════════════════════════════════════════════

-- ─── P1.1: Corrigir RLS de call_pro_calls ────────────────────────────────────────

DO $$
BEGIN
  DROP POLICY IF EXISTS "call_pro_calls_select" ON public.call_pro_calls;
  DROP POLICY IF EXISTS "call_pro_calls_insert" ON public.call_pro_calls;
  DROP POLICY IF EXISTS "call_pro_calls_update" ON public.call_pro_calls;
END $$;

-- SELECT: próprias chamadas OU gestor/super_admin
CREATE POLICY "call_pro_calls_select" ON public.call_pro_calls
  FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- INSERT: sistema/webhook pode inserir qualquer chamada (user_id mapeado via ramal)
CREATE POLICY "call_pro_calls_insert" ON public.call_pro_calls
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: apenas o operador da chamada OU gestor/super_admin
CREATE POLICY "call_pro_calls_update" ON public.call_pro_calls
  FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (true);

-- ─── P1.2: Adicionar is_online em call_pro_operator_mappings ─────────────────────

ALTER TABLE public.call_pro_operator_mappings
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

-- ─── P1.x: RLS para call_pro_settings (faltava completamente) ────────────────────

DO $$
BEGIN
  DROP POLICY IF EXISTS "call_pro_settings_select" ON public.call_pro_settings;
  DROP POLICY IF EXISTS "call_pro_settings_insert" ON public.call_pro_settings;
  DROP POLICY IF EXISTS "call_pro_settings_update" ON public.call_pro_settings;
END $$;

CREATE POLICY "call_pro_settings_select" ON public.call_pro_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "call_pro_settings_insert" ON public.call_pro_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "call_pro_settings_update" ON public.call_pro_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (true);

-- ─── P1.x: RLS para call_pro_tabulation_categories (faltava completamente) ───────

DO $$
BEGIN
  DROP POLICY IF EXISTS "call_pro_categories_select" ON public.call_pro_tabulation_categories;
  DROP POLICY IF EXISTS "call_pro_categories_insert" ON public.call_pro_tabulation_categories;
  DROP POLICY IF EXISTS "call_pro_categories_update" ON public.call_pro_tabulation_categories;
  DROP POLICY IF EXISTS "call_pro_categories_delete" ON public.call_pro_tabulation_categories;
END $$;

CREATE POLICY "call_pro_categories_select" ON public.call_pro_tabulation_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "call_pro_categories_insert" ON public.call_pro_tabulation_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "call_pro_categories_update" ON public.call_pro_tabulation_categories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (true);

CREATE POLICY "call_pro_categories_delete" ON public.call_pro_tabulation_categories
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- ─── P1.x: RLS para call_pro_operator_mappings (faltava completamente) ───────────

DO $$
BEGIN
  DROP POLICY IF EXISTS "call_pro_operators_select" ON public.call_pro_operator_mappings;
  DROP POLICY IF EXISTS "call_pro_operators_insert" ON public.call_pro_operator_mappings;
  DROP POLICY IF EXISTS "call_pro_operators_update" ON public.call_pro_operator_mappings;
  DROP POLICY IF EXISTS "call_pro_operators_delete" ON public.call_pro_operator_mappings;
END $$;

CREATE POLICY "call_pro_operators_select" ON public.call_pro_operator_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "call_pro_operators_insert" ON public.call_pro_operator_mappings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- UPDATE: operador pode atualizar seu próprio mapeamento (is_online) OU gestor/super_admin
CREATE POLICY "call_pro_operators_update" ON public.call_pro_operator_mappings
  FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (true);

CREATE POLICY "call_pro_operators_delete" ON public.call_pro_operator_mappings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );
