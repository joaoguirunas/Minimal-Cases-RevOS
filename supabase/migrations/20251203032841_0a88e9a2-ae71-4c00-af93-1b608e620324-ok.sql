-- Drop existing insert policy that's too restrictive
DROP POLICY IF EXISTS "teams_insert_authenticated" ON public.project_teams;

-- Create new insert policy that allows authenticated users to create teams
CREATE POLICY "teams_insert_authenticated" 
ON public.project_teams 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also ensure we can add members when creating a team
DROP POLICY IF EXISTS "team_members_insert" ON public.project_team_members;

CREATE POLICY "team_members_insert" 
ON public.project_team_members 
FOR INSERT 
TO authenticated
WITH CHECK (true);