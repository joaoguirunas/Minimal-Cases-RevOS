-- Drop existing policies for project_team_members
DROP POLICY IF EXISTS "team_members_select" ON public.project_team_members;
DROP POLICY IF EXISTS "team_members_update" ON public.project_team_members;
DROP POLICY IF EXISTS "team_members_delete" ON public.project_team_members;

-- Drop existing policies for project_team_management_links
DROP POLICY IF EXISTS "team_links_select" ON public.project_team_management_links;
DROP POLICY IF EXISTS "team_links_insert" ON public.project_team_management_links;
DROP POLICY IF EXISTS "team_links_delete" ON public.project_team_management_links;

-- Drop existing policy for project_teams
DROP POLICY IF EXISTS "teams_select_member" ON public.project_teams;

-- =====================================================
-- Project Team Members policies (allow admins/gestors)
-- =====================================================

CREATE POLICY "team_members_select" ON public.project_team_members
FOR SELECT USING (is_admin_or_gestor() OR is_team_member(team_id));

CREATE POLICY "team_members_update" ON public.project_team_members
FOR UPDATE USING (is_admin_or_gestor() OR is_team_admin(team_id))
WITH CHECK (is_admin_or_gestor() OR is_team_admin(team_id));

CREATE POLICY "team_members_delete" ON public.project_team_members
FOR DELETE USING (is_admin_or_gestor() OR is_team_admin(team_id));

-- =====================================================
-- Project Team Management Links policies
-- =====================================================

CREATE POLICY "team_links_select" ON public.project_team_management_links
FOR SELECT USING (
  is_admin_or_gestor() OR 
  is_team_member(delivery_team_id) OR 
  is_team_member(management_team_id)
);

CREATE POLICY "team_links_insert" ON public.project_team_management_links
FOR INSERT WITH CHECK (is_admin_or_gestor() OR is_team_admin(delivery_team_id));

CREATE POLICY "team_links_delete" ON public.project_team_management_links
FOR DELETE USING (is_admin_or_gestor() OR is_team_admin(delivery_team_id));

-- =====================================================
-- Project Teams SELECT policy (allow admins/gestors)
-- =====================================================

CREATE POLICY "teams_select_member" ON public.project_teams
FOR SELECT USING (
  is_admin_or_gestor() OR 
  created_by = auth.uid() OR 
  is_team_member(id)
);