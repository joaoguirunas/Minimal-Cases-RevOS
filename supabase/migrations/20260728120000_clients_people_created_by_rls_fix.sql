-- Bug real, achado via simulação de RLS como usuária 'comercial' (Aurea):
-- criar um novo cliente (NovoNegocioModal → useCriarPessoa) sempre falhava com
-- "new row violates row-level security policy for table clients_people" pra
-- qualquer usuário não-admin/manager.
--
-- Causa: useCriarPessoa faz `INSERT ... .select().single()` — o RETURNING
-- exige que a linha recém-criada passe também pela policy de SELECT
-- (users_read_own_clients), que hoje só concede visibilidade via um lead JÁ
-- existente vinculado à pessoa. No momento do INSERT da pessoa, esse lead
-- ainda não existe (é criado logo depois, em outro INSERT) — clássico
-- problema do ovo e da galinha em RLS. is_admin_or_manager() mascarava isso
-- pra admin/manager, por isso só reproduzia pra 'comercial'.
--
-- Fix: rastrear quem criou o contato (created_by) e usar isso como mais um
-- caminho de visibilidade — resolve tanto o problema imediato do RETURNING
-- quanto o caso mais amplo de criar um contato sem vincular a nenhum
-- pipeline/lead (ex: só cadastro, sem negócio ainda), que hoje ficaria
-- invisível pra sempre pro usuário 'comercial' que criou.

ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL
    DEFAULT public.get_current_settings_user_id();

DROP POLICY IF EXISTS users_read_own_clients ON public.clients_people;
CREATE POLICY users_read_own_clients ON public.clients_people
  FOR SELECT
  USING (
    is_admin_or_manager()
    OR created_by = get_current_settings_user_id()
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM leads l
      JOIN settings_users_teams sut ON sut.team_id = l.teams_id
      WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.people_id = clients_people.id AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
    )
  );

DROP POLICY IF EXISTS users_update_own_clients ON public.clients_people;
CREATE POLICY users_update_own_clients ON public.clients_people
  FOR UPDATE
  USING (
    is_admin_or_manager()
    OR created_by = get_current_settings_user_id()
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM leads l
      JOIN settings_users_teams sut ON sut.team_id = l.teams_id
      WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.people_id = clients_people.id AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
    )
  )
  WITH CHECK (
    is_admin_or_manager()
    OR created_by = get_current_settings_user_id()
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.people_id = clients_people.id AND l.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM leads l
      JOIN settings_users_teams sut ON sut.team_id = l.teams_id
      WHERE l.people_id = clients_people.id AND sut.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.people_id = clients_people.id AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
    )
  );
