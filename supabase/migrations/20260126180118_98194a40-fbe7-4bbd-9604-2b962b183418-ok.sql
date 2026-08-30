-- Update RLS policy for project_tasks to allow clients with can_create_tasks permission to INSERT
DROP POLICY IF EXISTS "tasks_insert_team_member" ON project_tasks;
CREATE POLICY "tasks_insert_team_member" ON project_tasks
FOR INSERT WITH CHECK (
  is_admin_or_gestor() 
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_id AND is_team_admin_or_member(p.team_id)
  ))
  OR (project_id IS NOT NULL AND client_can_create_tasks(project_id))
  OR (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
);