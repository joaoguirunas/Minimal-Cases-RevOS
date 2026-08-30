-- =============================================================================
-- Migration: N8N-WAA-5 — RLS policies for ai_agents_execution_log
-- =============================================================================
-- Context:
--   fix_rls_security (P1/P2) enabled RLS on ai_agents_execution_log but did
--   not add any policies, causing all authenticated reads to return 0 rows.
--   The ExecucoesTab in HistoricoTab queries this table directly; without a
--   SELECT policy the tab always shows empty.
--
--   Pattern: matches ai_agents_history — gestor/admin full access.
--   The agent config UI (where this tab appears) is already gated to gestores,
--   so a simple is_admin_or_manager() guard is correct.
-- =============================================================================

-- SELECT + ALL for gestores/admins
CREATE POLICY "exec_log_admin_all"
  ON public.ai_agents_execution_log
  FOR ALL
  TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());

-- service_role bypass (edge functions write with service_role key — this is
-- technically redundant since service_role bypasses RLS, but explicit is better)
CREATE POLICY "exec_log_service_role_all"
  ON public.ai_agents_execution_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
