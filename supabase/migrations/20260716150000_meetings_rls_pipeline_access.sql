-- Mesma lacuna corrigida em leads (20260716140000) — RLS de `meetings`
-- (users_manage_own_meetings / users_read_own_meetings) também não conhecia
-- acesso por pipeline-via-equipe. A checagem de SELECT já olhava o lead
-- vinculado (l.user_id/l.teams_id), mas leads sem atribuição individual
-- (a maioria) continuavam bloqueando reuniões de 'comercial' mesmo com a
-- equipe corretamente vinculada ao pipeline do lead.

DROP POLICY IF EXISTS users_manage_own_meetings ON public.meetings;
CREATE POLICY users_manage_own_meetings ON public.meetings
  FOR ALL
  USING (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (SELECT settings_users_teams.team_id FROM settings_users_teams WHERE settings_users_teams.user_id = get_current_settings_user_id()))
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = meetings.lead_id
        AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
    )
  )
  WITH CHECK (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (SELECT settings_users_teams.team_id FROM settings_users_teams WHERE settings_users_teams.user_id = get_current_settings_user_id()))
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = meetings.lead_id
        AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
    )
  );

DROP POLICY IF EXISTS users_read_own_meetings ON public.meetings;
CREATE POLICY users_read_own_meetings ON public.meetings
  FOR SELECT
  USING (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (SELECT settings_users_teams.team_id FROM settings_users_teams WHERE settings_users_teams.user_id = get_current_settings_user_id()))
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = meetings.lead_id
        AND (
          l.user_id = get_current_settings_user_id()
          OR l.teams_id IN (SELECT settings_users_teams.team_id FROM settings_users_teams WHERE settings_users_teams.user_id = get_current_settings_user_id())
          OR lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
        )
    )
  );
