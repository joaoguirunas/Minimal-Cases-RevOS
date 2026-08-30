
-- =====================================================
-- FUNÇÕES AUXILIARES (Security Definer)
-- =====================================================

-- 1. Verifica se usuário é membro de uma equipe
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    JOIN public.settings_users su ON ptm.user_id = su.id
    WHERE ptm.team_id = p_team_id
      AND su.auth_user_id = auth.uid()
  )
$$;

-- 2. Obtém role do usuário na equipe
CREATE OR REPLACE FUNCTION public.get_user_team_role(p_team_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ptm.role
  FROM public.project_team_members ptm
  JOIN public.settings_users su ON ptm.user_id = su.id
  WHERE ptm.team_id = p_team_id
    AND su.auth_user_id = auth.uid()
  LIMIT 1
$$;

-- 3. Verifica se usuário é admin de uma equipe
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    JOIN public.settings_users su ON ptm.user_id = su.id
    WHERE ptm.team_id = p_team_id
      AND su.auth_user_id = auth.uid()
      AND ptm.role = 'admin'
  )
$$;

-- 4. Verifica se usuário é admin ou member de uma equipe
CREATE OR REPLACE FUNCTION public.is_team_admin_or_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    JOIN public.settings_users su ON ptm.user_id = su.id
    WHERE ptm.team_id = p_team_id
      AND su.auth_user_id = auth.uid()
      AND ptm.role IN ('admin', 'member')
  )
$$;

-- 5. Obtém settings_user_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_current_settings_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.settings_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- 6. Conta tarefas por status de um projeto
CREATE OR REPLACE FUNCTION public.get_project_task_counts(p_project_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'backlog', COUNT(*) FILTER (WHERE status = 'backlog'),
    'sprint', COUNT(*) FILTER (WHERE status = 'sprint'),
    'doing', COUNT(*) FILTER (WHERE status = 'doing'),
    'done', COUNT(*) FILTER (WHERE status = 'done')
  )
  FROM public.project_tasks
  WHERE project_id = p_project_id
$$;

-- 7. Move tarefa (atualiza status e ordem)
CREATE OR REPLACE FUNCTION public.move_task(
  p_task_id uuid,
  p_new_status text,
  p_new_sort_order integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.project_tasks
  SET 
    status = p_new_status,
    sort_order = p_new_sort_order,
    completed_at = CASE 
      WHEN p_new_status = 'done' AND completed_at IS NULL THEN now()
      WHEN p_new_status != 'done' THEN NULL
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = p_task_id;
END;
$$;

-- 8. Estatísticas de dashboard por período
CREATE OR REPLACE FUNCTION public.get_project_dashboard_stats(
  p_team_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_tasks', COUNT(*),
    'completed_tasks', COUNT(*) FILTER (WHERE t.status = 'done'),
    'in_progress_tasks', COUNT(*) FILTER (WHERE t.status = 'doing'),
    'sprint_tasks', COUNT(*) FILTER (WHERE t.status = 'sprint'),
    'backlog_tasks', COUNT(*) FILTER (WHERE t.status = 'backlog'),
    'total_time_minutes', COALESCE(SUM(t.time_spent_minutes), 0),
    'avg_time_per_task_minutes', ROUND(COALESCE(AVG(t.time_spent_minutes) FILTER (WHERE t.status = 'done'), 0)::numeric, 2)
  ) INTO result
  FROM public.project_tasks t
  JOIN public.projects p ON t.project_id = p.id
  WHERE 
    (p_team_id IS NULL OR p.team_id = p_team_id)
    AND (p_project_id IS NULL OR t.project_id = p_project_id)
    AND (p_user_id IS NULL OR t.assignee_id = p_user_id)
    AND (p_start_date IS NULL OR t.completed_at::date >= p_start_date)
    AND (p_end_date IS NULL OR t.completed_at::date <= p_end_date);
  
  RETURN result;
END;
$$;

-- 9. Ranking de usuários
CREATE OR REPLACE FUNCTION public.get_project_user_ranking(
  p_team_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_avatar text,
  completed_tasks bigint,
  total_time_minutes bigint,
  rank_tasks bigint,
  rank_time bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT 
      t.assignee_id,
      COUNT(*) FILTER (WHERE t.status = 'done') as completed,
      COALESCE(SUM(t.time_spent_minutes) FILTER (WHERE t.status = 'done'), 0)::bigint as time_spent
    FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE 
      t.assignee_id IS NOT NULL
      AND (p_team_id IS NULL OR p.team_id = p_team_id)
      AND (p_start_date IS NULL OR t.completed_at::date >= p_start_date)
      AND (p_end_date IS NULL OR t.completed_at::date <= p_end_date)
    GROUP BY t.assignee_id
  )
  SELECT 
    us.assignee_id as user_id,
    u.name as user_name,
    u.avatar_url as user_avatar,
    us.completed as completed_tasks,
    us.time_spent as total_time_minutes,
    RANK() OVER (ORDER BY us.completed DESC)::bigint as rank_tasks,
    RANK() OVER (ORDER BY us.time_spent DESC)::bigint as rank_time
  FROM user_stats us
  JOIN public.settings_users u ON us.assignee_id = u.id
  ORDER BY us.completed DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- REMOVER POLICIES EXISTENTES
-- =====================================================

DROP POLICY IF EXISTS "authenticated_read_project_teams" ON public.project_teams;
DROP POLICY IF EXISTS "authenticated_write_project_teams" ON public.project_teams;
DROP POLICY IF EXISTS "authenticated_read_project_team_members" ON public.project_team_members;
DROP POLICY IF EXISTS "authenticated_write_project_team_members" ON public.project_team_members;
DROP POLICY IF EXISTS "authenticated_read_projects" ON public.projects;
DROP POLICY IF EXISTS "authenticated_write_projects" ON public.projects;
DROP POLICY IF EXISTS "authenticated_read_project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "authenticated_write_project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "authenticated_read_project_task_subtasks" ON public.project_task_subtasks;
DROP POLICY IF EXISTS "authenticated_write_project_task_subtasks" ON public.project_task_subtasks;
DROP POLICY IF EXISTS "authenticated_read_project_task_comments" ON public.project_task_comments;
DROP POLICY IF EXISTS "authenticated_write_project_task_comments" ON public.project_task_comments;

-- =====================================================
-- RLS POLICIES - project_teams
-- =====================================================

-- SELECT: usuário pode ver equipes onde é membro
CREATE POLICY "teams_select_member"
ON public.project_teams
FOR SELECT
TO authenticated
USING (public.is_team_member(id));

-- INSERT: usuário autenticado pode criar
CREATE POLICY "teams_insert_authenticated"
ON public.project_teams
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: apenas admin da equipe pode editar
CREATE POLICY "teams_update_admin"
ON public.project_teams
FOR UPDATE
TO authenticated
USING (public.is_team_admin(id))
WITH CHECK (public.is_team_admin(id));

-- DELETE: apenas admin da equipe pode deletar
CREATE POLICY "teams_delete_admin"
ON public.project_teams
FOR DELETE
TO authenticated
USING (public.is_team_admin(id));

-- =====================================================
-- RLS POLICIES - project_team_members
-- =====================================================

-- SELECT: membros da equipe podem ver outros membros
CREATE POLICY "team_members_select"
ON public.project_team_members
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

-- INSERT: admin da equipe pode adicionar membros
CREATE POLICY "team_members_insert"
ON public.project_team_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_team_admin(team_id)
  OR NOT EXISTS (SELECT 1 FROM public.project_team_members WHERE team_id = project_team_members.team_id)
);

-- UPDATE: admin da equipe pode alterar roles
CREATE POLICY "team_members_update"
ON public.project_team_members
FOR UPDATE
TO authenticated
USING (public.is_team_admin(team_id))
WITH CHECK (public.is_team_admin(team_id));

-- DELETE: admin da equipe pode remover membros
CREATE POLICY "team_members_delete"
ON public.project_team_members
FOR DELETE
TO authenticated
USING (public.is_team_admin(team_id));

-- =====================================================
-- RLS POLICIES - projects
-- =====================================================

-- SELECT: usuário pode ver projetos das equipes onde é membro
CREATE POLICY "projects_select_team_member"
ON public.projects
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

-- INSERT: admin ou member da equipe pode criar
CREATE POLICY "projects_insert_team_member"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (public.is_team_admin_or_member(team_id));

-- UPDATE: admin ou member da equipe pode editar
CREATE POLICY "projects_update_team_member"
ON public.projects
FOR UPDATE
TO authenticated
USING (public.is_team_admin_or_member(team_id))
WITH CHECK (public.is_team_admin_or_member(team_id));

-- DELETE: apenas admin da equipe pode deletar
CREATE POLICY "projects_delete_admin"
ON public.projects
FOR DELETE
TO authenticated
USING (public.is_team_admin(team_id));

-- =====================================================
-- RLS POLICIES - project_tasks
-- =====================================================

-- SELECT: membros da equipe do projeto
CREATE POLICY "tasks_select_team_member"
ON public.project_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND public.is_team_member(p.team_id)
  )
);

-- INSERT: membros da equipe podem criar
CREATE POLICY "tasks_insert_team_member"
ON public.project_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND public.is_team_admin_or_member(p.team_id)
  )
);

-- UPDATE: membros da equipe podem editar
CREATE POLICY "tasks_update_team_member"
ON public.project_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND public.is_team_admin_or_member(p.team_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND public.is_team_admin_or_member(p.team_id)
  )
);

-- DELETE: admin da equipe ou criador da tarefa
CREATE POLICY "tasks_delete_admin_or_creator"
ON public.project_tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND public.is_team_admin(p.team_id)
  )
  OR created_by = auth.uid()
);

-- =====================================================
-- RLS POLICIES - project_task_subtasks
-- =====================================================

-- SELECT: membros da equipe
CREATE POLICY "subtasks_select_team_member"
ON public.project_task_subtasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_id
    AND public.is_team_member(p.team_id)
  )
);

-- INSERT: membros da equipe
CREATE POLICY "subtasks_insert_team_member"
ON public.project_task_subtasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_id
    AND public.is_team_admin_or_member(p.team_id)
  )
);

-- UPDATE: membros da equipe
CREATE POLICY "subtasks_update_team_member"
ON public.project_task_subtasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_id
    AND public.is_team_admin_or_member(p.team_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_id
    AND public.is_team_admin_or_member(p.team_id)
  )
);

-- DELETE: membros da equipe
CREATE POLICY "subtasks_delete_team_member"
ON public.project_task_subtasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_id
    AND public.is_team_admin_or_member(p.team_id)
  )
);

-- =====================================================
-- RLS POLICIES - project_task_comments
-- =====================================================

-- SELECT: membros da equipe
CREATE POLICY "comments_select_team_member"
ON public.project_task_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_id
    AND public.is_team_member(p.team_id)
  )
);

-- INSERT: membros da equipe
CREATE POLICY "comments_insert_team_member"
ON public.project_task_comments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_id
    AND public.is_team_admin_or_member(p.team_id)
  )
);

-- UPDATE: apenas autor do comentário
CREATE POLICY "comments_update_author"
ON public.project_task_comments
FOR UPDATE
TO authenticated
USING (user_id = public.get_current_settings_user_id())
WITH CHECK (user_id = public.get_current_settings_user_id());

-- DELETE: apenas autor do comentário
CREATE POLICY "comments_delete_author"
ON public.project_task_comments
FOR DELETE
TO authenticated
USING (user_id = public.get_current_settings_user_id());
