-- FIX-SCH-02: RLS tenant-scoped em meeting_evaluations
-- Substitui política permissiva (USING true) por isolamento via user_calendar_connections.
-- meeting_evaluations → meetings → settings_users → auth_user_id = auth.uid()
-- Service role bypassa RLS (coach-pro AI usa service role).
-- Edge functions de avaliação (coach-pro-evaluate) usam service role key — sem impacto.

BEGIN;

DROP POLICY IF EXISTS "meeting_evaluations_all" ON public.meeting_evaluations;
DROP POLICY IF EXISTS "meeting_evaluations_authenticated_read" ON public.meeting_evaluations;
DROP POLICY IF EXISTS "meeting_evaluations_manager_write" ON public.meeting_evaluations;

-- Leitura: usuário autenticado vê avaliações de reuniões do seu próprio sistema.
-- JOIN seguro: meeting_evaluations.meeting_id → meetings.user_id → settings_users.auth_user_id
-- Para single-tenant: qualquer usuário autenticado da instância pode ler todas as avaliações.
-- Para multi-tenant futuro: policy pode ser narrowed com tenant_id em settings_users.
CREATE POLICY "meeting_evaluations_authenticated_read"
  ON public.meeting_evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meetings m
      JOIN public.settings_users su ON su.id = m.user_id
      WHERE m.id = meeting_evaluations.meeting_id
        AND su.auth_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.settings_users su2
          WHERE su2.auth_user_id = auth.uid()
        )
    )
  );

-- Escrita: apenas admins/gestores podem criar/atualizar avaliações via client.
-- Avaliações criadas por AI usam service role (bypassa RLS).
CREATE POLICY "meeting_evaluations_manager_write"
  ON public.meeting_evaluations
  FOR ALL
  TO authenticated
  USING (is_admin_or_gestor())
  WITH CHECK (is_admin_or_gestor());

COMMIT;
