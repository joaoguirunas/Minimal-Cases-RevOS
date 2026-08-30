-- Drop all existing INSERT policies for project_teams (both names)
DROP POLICY IF EXISTS "teams_insert_authenticated" ON public.project_teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.project_teams;

-- Recreate INSERT policy with correct name
CREATE POLICY "teams_insert_authenticated" 
ON public.project_teams 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Also drop and recreate UPDATE policy
DROP POLICY IF EXISTS "teams_update_admin" ON public.project_teams;
DROP POLICY IF EXISTS "Team admins can update teams" ON public.project_teams;

CREATE POLICY "teams_update_admin" 
ON public.project_teams 
FOR UPDATE 
TO authenticated 
USING (
  created_by IS NULL 
  OR EXISTS (SELECT 1 FROM public.settings_users WHERE auth_user_id = auth.uid() AND id = project_teams.created_by)
  OR public.is_team_admin(id)
)
WITH CHECK (true);

-- Drop and recreate DELETE policy  
DROP POLICY IF EXISTS "teams_delete_admin" ON public.project_teams;
DROP POLICY IF EXISTS "Team admins can delete teams" ON public.project_teams;

CREATE POLICY "teams_delete_admin" 
ON public.project_teams 
FOR DELETE 
TO authenticated 
USING (
  created_by IS NULL 
  OR EXISTS (SELECT 1 FROM public.settings_users WHERE auth_user_id = auth.uid() AND id = project_teams.created_by)
  OR public.is_team_admin(id)
);