-- Drop existing policies
DROP POLICY IF EXISTS subtasks_select_team_member ON project_task_subtasks;
DROP POLICY IF EXISTS subtasks_insert_team_member ON project_task_subtasks;
DROP POLICY IF EXISTS subtasks_update_team_member ON project_task_subtasks;
DROP POLICY IF EXISTS subtasks_delete_team_member ON project_task_subtasks;

-- Create new policies that include is_admin_or_gestor and handle tasks without projects
CREATE POLICY "subtasks_select" ON project_task_subtasks
FOR SELECT USING (
  is_admin_or_gestor() OR
  EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      -- Task with project
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p WHERE p.id = t.project_id AND is_team_member(p.team_id)
      ))
      OR
      -- Task without project (team-level)
      (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_member(t.team_id))
    )
  )
);

CREATE POLICY "subtasks_insert" ON project_task_subtasks
FOR INSERT WITH CHECK (
  is_admin_or_gestor() OR
  EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR
      (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
    )
  )
);

CREATE POLICY "subtasks_update" ON project_task_subtasks
FOR UPDATE USING (
  is_admin_or_gestor() OR
  EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR
      (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
    )
  )
) WITH CHECK (
  is_admin_or_gestor() OR
  EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR
      (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
    )
  )
);

CREATE POLICY "subtasks_delete" ON project_task_subtasks
FOR DELETE USING (
  is_admin_or_gestor() OR
  EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR
      (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
    )
  )
);