-- ============================================
-- FIX RLS POLICIES FOR CLIENT USERS
-- Create functions FIRST, then policies
-- ============================================

-- 1. Create helper function for client comment permission
CREATE OR REPLACE FUNCTION public.client_can_comment(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_user_projects cup
    JOIN public.settings_users su ON cup.user_id = su.id
    WHERE cup.project_id = p_project_id
      AND su.auth_user_id = auth.uid()
      AND su.user_type = 'cliente'
      AND su.active = true
      AND cup.can_comment = true
  )
$$;

-- 2. Allow clients to see team members for assignment dropdown
DROP POLICY IF EXISTS "team_members_select" ON project_team_members;
CREATE POLICY "team_members_select" ON project_team_members
FOR SELECT USING (
  is_admin_or_gestor() 
  OR is_team_member(team_id)
  OR client_has_team_access(team_id)
);

-- 3. Allow clients with can_create_tasks permission to add subtasks
DROP POLICY IF EXISTS "subtasks_insert" ON project_task_subtasks;
CREATE POLICY "subtasks_insert" ON project_task_subtasks
FOR INSERT WITH CHECK (
  is_admin_or_gestor() 
  OR (EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
      OR (t.project_id IS NOT NULL AND client_can_create_tasks(t.project_id))
    )
  ))
);

-- 4. Allow clients to update subtasks (with edit permission)
DROP POLICY IF EXISTS "subtasks_update" ON project_task_subtasks;
CREATE POLICY "subtasks_update" ON project_task_subtasks
FOR UPDATE USING (
  is_admin_or_gestor() 
  OR (EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
      OR (t.project_id IS NOT NULL AND client_can_edit_tasks(t.project_id))
    )
  ))
) WITH CHECK (
  is_admin_or_gestor() 
  OR (EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
      OR (t.project_id IS NOT NULL AND client_can_edit_tasks(t.project_id))
    )
  ))
);

-- 5. Allow clients to delete subtasks (with edit permission)
DROP POLICY IF EXISTS "subtasks_delete" ON project_task_subtasks;
CREATE POLICY "subtasks_delete" ON project_task_subtasks
FOR DELETE USING (
  is_admin_or_gestor() 
  OR (EXISTS (
    SELECT 1 FROM project_tasks t
    WHERE t.id = project_task_subtasks.task_id
    AND (
      (t.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = t.project_id AND is_team_admin_or_member(p.team_id)
      ))
      OR (t.project_id IS NULL AND t.team_id IS NOT NULL AND is_team_admin_or_member(t.team_id))
      OR (t.project_id IS NOT NULL AND client_can_edit_tasks(t.project_id))
    )
  ))
);

-- 6. Allow clients to view comments on tasks they have access to
DROP POLICY IF EXISTS "comments_select_team_member" ON project_task_comments;
CREATE POLICY "comments_select_team_member" ON project_task_comments
FOR SELECT USING (
  is_admin_or_gestor()
  OR (EXISTS (
    SELECT 1 FROM project_tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = project_task_comments.task_id 
    AND (is_team_member(p.team_id) OR client_has_project_access(p.id))
  ))
);

-- 7. Allow clients with comment permission to insert comments
DROP POLICY IF EXISTS "comments_insert_team_member" ON project_task_comments;
CREATE POLICY "comments_insert_team_member" ON project_task_comments
FOR INSERT WITH CHECK (
  is_admin_or_gestor()
  OR (EXISTS (
    SELECT 1 FROM project_tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = project_task_comments.task_id 
    AND (is_team_admin_or_member(p.team_id) OR client_can_comment(p.id))
  ))
);