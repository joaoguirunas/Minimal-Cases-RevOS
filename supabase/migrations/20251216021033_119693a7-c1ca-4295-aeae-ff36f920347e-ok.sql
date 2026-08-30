-- Drop existing policies
DROP POLICY IF EXISTS "tasks_select_team_member" ON public.project_tasks;
DROP POLICY IF EXISTS "tasks_insert_team_member" ON public.project_tasks;
DROP POLICY IF EXISTS "tasks_update_team_member" ON public.project_tasks;
DROP POLICY IF EXISTS "tasks_delete_admin_or_creator" ON public.project_tasks;

-- Create new policies that also allow admins/gestors

-- SELECT: team members OR admins/gestors
CREATE POLICY "tasks_select_team_member" ON public.project_tasks
FOR SELECT USING (
  is_admin_or_gestor() OR
  (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_member(p.team_id)
    ))
    OR 
    (project_id IS NULL AND team_id IS NOT NULL AND is_team_member(team_id))
  )
);

-- INSERT: team members OR admins/gestors
CREATE POLICY "tasks_insert_team_member" ON public.project_tasks
FOR INSERT WITH CHECK (
  is_admin_or_gestor() OR
  (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
    ))
    OR 
    (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
  )
);

-- UPDATE: team members OR admins/gestors
CREATE POLICY "tasks_update_team_member" ON public.project_tasks
FOR UPDATE USING (
  is_admin_or_gestor() OR
  (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
    ))
    OR 
    (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
  )
)
WITH CHECK (
  is_admin_or_gestor() OR
  (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
    ))
    OR 
    (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
  )
);

-- DELETE: team admins, task creator, OR admins/gestors
CREATE POLICY "tasks_delete_admin_or_creator" ON public.project_tasks
FOR DELETE USING (
  is_admin_or_gestor() OR
  (
    (project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin(p.team_id))
      OR created_by = auth.uid()
    ))
    OR 
    (project_id IS NULL AND team_id IS NOT NULL AND (is_team_admin(team_id) OR created_by = auth.uid()))
  )
);