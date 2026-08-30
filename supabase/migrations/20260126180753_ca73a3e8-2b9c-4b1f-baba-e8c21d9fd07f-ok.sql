-- Create helper function to check if a client user has access to any project in a team
CREATE OR REPLACE FUNCTION public.client_has_team_access(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_user_projects cup
    JOIN public.settings_users su ON cup.user_id = su.id
    JOIN public.projects p ON p.id = cup.project_id
    WHERE p.team_id = p_team_id
      AND su.auth_user_id = auth.uid()
      AND su.user_type = 'cliente'
      AND su.active = true
      AND cup.can_view = true
  )
$$;

-- Update RLS policy on project_teams to allow clients to see teams they have project access to
DROP POLICY IF EXISTS "teams_select_member" ON project_teams;
CREATE POLICY "teams_select_member" ON project_teams
FOR SELECT USING (
  is_admin_or_gestor() 
  OR (created_by = auth.uid()) 
  OR is_team_member(id)
  OR client_has_team_access(id)
);