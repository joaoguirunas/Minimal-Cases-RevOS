DROP POLICY IF EXISTS users_update_own_clients ON public.clients_people;
CREATE POLICY users_update_own_clients ON public.clients_people
  FOR UPDATE
  USING (
    is_admin_or_manager()
    OR EXISTS (SELECT 1 FROM leads l WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id())
    OR EXISTS (SELECT 1 FROM leads l JOIN settings_users_teams sut ON sut.team_id = l.teams_id WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id())
    OR EXISTS (SELECT 1 FROM leads l WHERE l.people_id = clients_people.id AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id))
  )
  WITH CHECK (
    is_admin_or_manager()
    OR EXISTS (SELECT 1 FROM leads l WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id())
    OR EXISTS (SELECT 1 FROM leads l JOIN settings_users_teams sut ON sut.team_id = l.teams_id WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id())
    OR EXISTS (SELECT 1 FROM leads l WHERE l.people_id = clients_people.id AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id))
  );

DROP POLICY IF EXISTS users_read_own_clients ON public.clients_people;
CREATE POLICY users_read_own_clients ON public.clients_people
  FOR SELECT
  USING (
    is_admin_or_manager()
    OR EXISTS (SELECT 1 FROM leads l WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id())
    OR EXISTS (SELECT 1 FROM leads l JOIN settings_users_teams sut ON sut.team_id = l.teams_id WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id())
    OR EXISTS (SELECT 1 FROM leads l WHERE l.people_id = clients_people.id AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id))
  );

ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS created_by;
