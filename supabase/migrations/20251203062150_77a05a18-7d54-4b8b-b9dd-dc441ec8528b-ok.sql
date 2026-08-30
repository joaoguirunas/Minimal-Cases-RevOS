-- Add team_id to project_tasks for tasks without projects
ALTER TABLE public.project_tasks
ADD COLUMN team_id uuid REFERENCES public.project_teams(id) ON DELETE CASCADE;

-- Create index for team_id
CREATE INDEX idx_project_tasks_team_id ON public.project_tasks(team_id);

-- Update RLS policy to allow access to tasks without project but with team_id
DROP POLICY IF EXISTS "tasks_select_team_member" ON public.project_tasks;
CREATE POLICY "tasks_select_team_member" ON public.project_tasks
FOR SELECT USING (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_member(p.team_id)
  ))
  OR
  (project_id IS NULL AND team_id IS NOT NULL AND is_team_member(team_id))
);

DROP POLICY IF EXISTS "tasks_insert_team_member" ON public.project_tasks;
CREATE POLICY "tasks_insert_team_member" ON public.project_tasks
FOR INSERT WITH CHECK (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
  ))
  OR
  (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
);

DROP POLICY IF EXISTS "tasks_update_team_member" ON public.project_tasks;
CREATE POLICY "tasks_update_team_member" ON public.project_tasks
FOR UPDATE USING (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
  ))
  OR
  (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
) WITH CHECK (
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
  ))
  OR
  (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
);

DROP POLICY IF EXISTS "tasks_delete_admin_or_creator" ON public.project_tasks;
CREATE POLICY "tasks_delete_admin_or_creator" ON public.project_tasks
FOR DELETE USING (
  (project_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_tasks.project_id AND is_team_admin(p.team_id))
    OR created_by = auth.uid()
  ))
  OR
  (project_id IS NULL AND team_id IS NOT NULL AND (
    is_team_admin(team_id) OR created_by = auth.uid()
  ))
);