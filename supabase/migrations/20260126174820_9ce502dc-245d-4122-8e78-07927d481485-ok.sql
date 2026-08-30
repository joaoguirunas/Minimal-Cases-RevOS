-- =====================================================
-- FASE 1: Tipo de Usuário CLIENTE
-- =====================================================

-- 1.1 Criar tabela de vínculo usuário-projeto para clientes
CREATE TABLE public.client_user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.settings_users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_edit_tasks BOOLEAN DEFAULT false,
  can_create_tasks BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.settings_users(id),
  UNIQUE(user_id, project_id)
);

-- Criar índices para performance
CREATE INDEX idx_client_user_projects_user_id ON public.client_user_projects(user_id);
CREATE INDEX idx_client_user_projects_project_id ON public.client_user_projects(project_id);

-- Habilitar RLS
ALTER TABLE public.client_user_projects ENABLE ROW LEVEL SECURITY;

-- RLS policies para client_user_projects (apenas admins/gestores podem gerenciar)
CREATE POLICY "admins_manage_client_projects" ON public.client_user_projects
FOR ALL USING (is_admin_or_gestor())
WITH CHECK (is_admin_or_gestor());

-- Clientes podem ver seus próprios vínculos
CREATE POLICY "clients_view_own_projects" ON public.client_user_projects
FOR SELECT USING (user_id = get_current_settings_user_id());

-- 1.2 Criar função para verificar se usuário atual é cliente
CREATE OR REPLACE FUNCTION public.is_client_user()
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
      AND user_type = 'cliente'
      AND active = true
  )
$$;

-- 1.3 Criar função para verificar acesso de cliente a um projeto específico
CREATE OR REPLACE FUNCTION public.client_has_project_access(p_project_id uuid)
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
      AND cup.can_view = true
  )
$$;

-- 1.4 Criar função para verificar se cliente pode editar tarefas
CREATE OR REPLACE FUNCTION public.client_can_edit_tasks(p_project_id uuid)
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
      AND cup.can_edit_tasks = true
  )
$$;

-- 1.5 Criar função para verificar se cliente pode criar tarefas
CREATE OR REPLACE FUNCTION public.client_can_create_tasks(p_project_id uuid)
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
      AND cup.can_create_tasks = true
  )
$$;

-- 1.6 Atualizar RLS policies para projects - SELECT
DROP POLICY IF EXISTS "projects_select_team_member" ON projects;
CREATE POLICY "projects_select_team_member" ON projects
FOR SELECT USING (
  is_admin_or_gestor() 
  OR is_team_member(team_id)
  OR client_has_project_access(id)
);

-- 1.7 Atualizar RLS policies para project_tasks - SELECT
DROP POLICY IF EXISTS "tasks_select_team_member" ON project_tasks;
CREATE POLICY "tasks_select_team_member" ON project_tasks
FOR SELECT USING (
  is_admin_or_gestor() 
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_tasks.project_id AND is_team_member(p.team_id)
  ))
  OR (project_id IS NOT NULL AND client_has_project_access(project_id))
  OR (project_id IS NULL AND team_id IS NOT NULL AND is_team_member(team_id))
);

-- 1.8 Atualizar RLS policies para project_tasks - UPDATE (clientes com permissão)
DROP POLICY IF EXISTS "tasks_update_team_member" ON project_tasks;
CREATE POLICY "tasks_update_team_member" ON project_tasks
FOR UPDATE USING (
  is_admin_or_gestor() 
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
  ))
  OR (project_id IS NOT NULL AND client_can_edit_tasks(project_id))
  OR (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
)
WITH CHECK (
  is_admin_or_gestor() 
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
  ))
  OR (project_id IS NOT NULL AND client_can_edit_tasks(project_id))
  OR (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
);

-- 1.9 Atualizar RLS policies para project_tasks - INSERT (clientes com permissão)
DROP POLICY IF EXISTS "tasks_insert_team_member" ON project_tasks;
CREATE POLICY "tasks_insert_team_member" ON project_tasks
FOR INSERT WITH CHECK (
  is_admin_or_gestor() 
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_tasks.project_id AND is_team_admin_or_member(p.team_id)
  ))
  OR (project_id IS NOT NULL AND client_can_create_tasks(project_id))
  OR (project_id IS NULL AND team_id IS NOT NULL AND is_team_admin_or_member(team_id))
);

-- 1.10 Atualizar RLS para project_task_subtasks - SELECT
DROP POLICY IF EXISTS "subtasks_select_team_member" ON project_task_subtasks;
CREATE POLICY "subtasks_select_team_member" ON project_task_subtasks
FOR SELECT USING (
  is_admin_or_gestor()
  OR EXISTS (
    SELECT 1 FROM project_tasks pt
    WHERE pt.id = project_task_subtasks.task_id
    AND (
      (pt.project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM projects p WHERE p.id = pt.project_id AND is_team_member(p.team_id)
      ))
      OR (pt.project_id IS NOT NULL AND client_has_project_access(pt.project_id))
      OR (pt.project_id IS NULL AND pt.team_id IS NOT NULL AND is_team_member(pt.team_id))
    )
  )
);

-- 1.11 Atualizar RLS para project_comments - SELECT (clientes podem ver comentários)
DROP POLICY IF EXISTS "comments_select_team_member" ON project_comments;
CREATE POLICY "comments_select_team_member" ON project_comments
FOR SELECT USING (
  is_admin_or_gestor() 
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_comments.project_id AND is_team_member(p.team_id)
  )
  OR client_has_project_access(project_id)
);