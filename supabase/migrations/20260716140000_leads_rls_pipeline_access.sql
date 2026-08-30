-- RLS de `leads` (users_read_own_leads / users_update_own_leads) só liberava
-- via is_admin_or_manager(), user_id = eu, ou teams_id = minha equipe. Leads
-- sem user_id/teams_id atribuído (a maioria) ficavam invisíveis pra qualquer
-- não-admin/manager mesmo com acesso liberado por PIPELINE via
-- settings_teams_pipelines (feature de equipes por pipeline) — o fix
-- client-side em useUserPermissions/Negocios.tsx não alcança RLS.
--
-- Adiciona uma 3ª via de acesso: equipe do usuário vinculada ao pipeline do
-- lead. Mesma regra de "sem equipe / equipe sem vínculo = universal" já usada
-- em useMyAllowedPipelineIds (useTeamsNew.ts), pra manter client e RLS
-- consistentes.

CREATE OR REPLACE FUNCTION public.lead_pipeline_accessible_to_current_user(p_leads_pipelines_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_team_ids uuid[];
  v_restricted_team_ids uuid[];
  v_has_universal_team boolean;
BEGIN
  v_user_id := public.get_current_settings_user_id();
  IF v_user_id IS NULL OR p_leads_pipelines_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ARRAY(SELECT team_id FROM public.settings_users_teams WHERE user_id = v_user_id)
    INTO v_team_ids;

  IF v_team_ids IS NULL OR array_length(v_team_ids, 1) IS NULL THEN
    RETURN true; -- sem equipe = sem restrição (mesma regra do client)
  END IF;

  SELECT ARRAY(SELECT DISTINCT team_id FROM public.settings_teams_pipelines WHERE team_id = ANY(v_team_ids))
    INTO v_restricted_team_ids;

  -- Qualquer equipe do usuário sem NENHUM vínculo em settings_teams_pipelines
  -- é "universal" (atende todos os pipelines) — basta uma pra liberar tudo.
  v_has_universal_team := EXISTS (
    SELECT 1 FROM unnest(v_team_ids) AS t(id)
    WHERE NOT (id = ANY(COALESCE(v_restricted_team_ids, ARRAY[]::uuid[])))
  );
  IF v_has_universal_team THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.settings_teams_pipelines stp
    WHERE stp.team_id = ANY(v_team_ids)
      AND stp.pipeline_id = p_leads_pipelines_id
  );
END;
$$;

DROP POLICY IF EXISTS users_read_own_leads ON public.leads;
CREATE POLICY users_read_own_leads ON public.leads
  FOR SELECT
  USING (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (SELECT settings_users_teams.team_id FROM settings_users_teams WHERE settings_users_teams.user_id = get_current_settings_user_id()))
    OR lead_pipeline_accessible_to_current_user(leads_pipelines_id)
  );

DROP POLICY IF EXISTS users_update_own_leads ON public.leads;
CREATE POLICY users_update_own_leads ON public.leads
  FOR UPDATE
  USING (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (SELECT settings_users_teams.team_id FROM settings_users_teams WHERE settings_users_teams.user_id = get_current_settings_user_id()))
    OR lead_pipeline_accessible_to_current_user(leads_pipelines_id)
  )
  WITH CHECK (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (SELECT settings_users_teams.team_id FROM settings_users_teams WHERE settings_users_teams.user_id = get_current_settings_user_id()))
    OR lead_pipeline_accessible_to_current_user(leads_pipelines_id)
  );
