-- P4.3: Fix overly permissive call_pro_calls INSERT and UPDATE WITH CHECK
-- These policies previously allowed any authenticated user to insert/update
-- any call record. Now they are restricted to own user or admin.

-- ──────────────────────────────────────────────────────────────────────────
-- call_pro_calls: tighten INSERT
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_pro_calls_insert" ON public.call_pro_calls;

CREATE POLICY "call_pro_calls_insert"
  ON public.call_pro_calls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Operator inserts their own call
    user_id IN (
      SELECT id FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
    -- Admin / gestor can insert on behalf of any operator
    OR EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- call_pro_calls: tighten UPDATE WITH CHECK
-- The USING (row filter) was already fixed in 20260224000000.
-- Only fix the WITH CHECK so updated rows stay in the same ownership scope.
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_pro_calls_update" ON public.call_pro_calls;

CREATE POLICY "call_pro_calls_update"
  ON public.call_pro_calls
  FOR UPDATE
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true AND deleted_at IS NULL
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- NOTE: call_pro_settings SELECT USING (true) is intentionally left as-is.
-- Settings are shared / tenant-global and all operators need to read them.
-- Mutations on settings are already restricted to gestor/super_admin.
--
-- NOTE: call_pro_tabulation_categories SELECT USING (true) is intentional.
-- Categories are shared definitions, read-only for all operators.
--
-- NOTE: call_pro_operator_mappings SELECT USING (true) is intentional.
-- Operators need to see the full mapping list for routing decisions.
-- ──────────────────────────────────────────────────────────────────────────
