-- Fix clients_people RLS: Replace overly permissive policies with proper access control
-- Users can only see clients linked to their leads, or if they are admin/gestor

-- First, drop the existing overly permissive policies
DROP POLICY IF EXISTS "authenticated_read" ON public.clients_people;
DROP POLICY IF EXISTS "authenticated_write" ON public.clients_people;

-- Create helper function to check if user is admin or gestor
CREATE OR REPLACE FUNCTION public.is_admin_or_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
  )
$$;

-- Policy: Users can read clients linked to their leads OR if they are admin/gestor
CREATE POLICY "users_read_own_clients" ON public.clients_people
FOR SELECT
TO authenticated
USING (
  -- Admins and gestors can see all clients
  is_admin_or_gestor()
  OR
  -- Regular users can only see clients linked to their leads
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.people_id = clients_people.id
    AND l.users_id = get_current_settings_user_id()
  )
  OR
  -- Users can see clients linked to leads in their teams
  EXISTS (
    SELECT 1 FROM public.leads l
    JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
    WHERE l.people_id = clients_people.id
    AND sut.user_id = get_current_settings_user_id()
  )
);

-- Policy: Users can insert new clients (needed for lead creation)
CREATE POLICY "users_insert_clients" ON public.clients_people
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Users can update clients linked to their leads OR if they are admin/gestor
CREATE POLICY "users_update_own_clients" ON public.clients_people
FOR UPDATE
TO authenticated
USING (
  is_admin_or_gestor()
  OR
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.people_id = clients_people.id
    AND l.users_id = get_current_settings_user_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.leads l
    JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
    WHERE l.people_id = clients_people.id
    AND sut.user_id = get_current_settings_user_id()
  )
)
WITH CHECK (
  is_admin_or_gestor()
  OR
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.people_id = clients_people.id
    AND l.users_id = get_current_settings_user_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.leads l
    JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
    WHERE l.people_id = clients_people.id
    AND sut.user_id = get_current_settings_user_id()
  )
);

-- Policy: Only admins/gestors can delete clients
CREATE POLICY "admins_delete_clients" ON public.clients_people
FOR DELETE
TO authenticated
USING (is_admin_or_gestor());