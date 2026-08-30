-- Drop existing INSERT policy and recreate properly
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.project_teams;

-- Create proper INSERT policy with WITH CHECK
CREATE POLICY "Authenticated users can create teams" 
ON public.project_teams 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Also ensure UPDATE and DELETE work for team admins/creators
DROP POLICY IF EXISTS "Team admins can update teams" ON public.project_teams;
CREATE POLICY "Team admins can update teams" 
ON public.project_teams 
FOR UPDATE 
TO authenticated 
USING (
  created_by IS NULL 
  OR created_by IN (SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid())
  OR public.is_team_admin(id)
)
WITH CHECK (true);

DROP POLICY IF EXISTS "Team admins can delete teams" ON public.project_teams;
CREATE POLICY "Team admins can delete teams" 
ON public.project_teams 
FOR DELETE 
TO authenticated 
USING (
  created_by IS NULL 
  OR created_by IN (SELECT id FROM public.settings_users WHERE auth_user_id = auth.uid())
  OR public.is_team_admin(id)
);