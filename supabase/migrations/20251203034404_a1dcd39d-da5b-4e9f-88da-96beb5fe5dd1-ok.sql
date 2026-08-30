-- Drop e recria política de SELECT para project_teams
DROP POLICY IF EXISTS "teams_select_member" ON public.project_teams;

CREATE POLICY "teams_select_member" 
ON public.project_teams 
FOR SELECT 
TO authenticated 
USING (
  created_by = auth.uid()
  OR is_team_member(id)
);