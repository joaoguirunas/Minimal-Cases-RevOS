-- =============================================
-- PROJECT MANAGEMENT MODULE - DATABASE SCHEMA
-- =============================================

-- 1. PROJECT TEAMS TABLE
CREATE TABLE public.project_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. PROJECT TEAM MEMBERS TABLE
CREATE TABLE public.project_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.project_teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.settings_users(id),
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 3. PROJECTS TABLE
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  accesses TEXT,
  client_id UUID REFERENCES public.clients_companies(id),
  team_id UUID NOT NULL REFERENCES public.project_teams(id),
  status TEXT DEFAULT 'active',
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. PROJECT TASKS TABLE
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'backlog',
  priority TEXT DEFAULT 'medium',
  assignee_id UUID REFERENCES public.settings_users(id),
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_hours NUMERIC,
  time_spent_minutes INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 5. PROJECT TASK SUBTASKS TABLE
CREATE TABLE public.project_task_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  time_spent_minutes INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. PROJECT TASK COMMENTS TABLE
CREATE TABLE public.project_task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.settings_users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_project_team_members_team_id ON public.project_team_members(team_id);
CREATE INDEX idx_project_team_members_user_id ON public.project_team_members(user_id);
CREATE INDEX idx_projects_team_id ON public.projects(team_id);
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_assignee_status ON public.project_tasks(assignee_id, status);
CREATE INDEX idx_project_tasks_project_status ON public.project_tasks(project_id, status);
CREATE INDEX idx_project_tasks_due_date ON public.project_tasks(due_date);
CREATE INDEX idx_project_task_subtasks_task_id ON public.project_task_subtasks(task_id);
CREATE INDEX idx_project_task_comments_task_id ON public.project_task_comments(task_id);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.project_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - PROJECT TEAMS
-- =============================================

CREATE POLICY "authenticated_read_project_teams" 
ON public.project_teams 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_write_project_teams" 
ON public.project_teams 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =============================================
-- RLS POLICIES - PROJECT TEAM MEMBERS
-- =============================================

CREATE POLICY "authenticated_read_project_team_members" 
ON public.project_team_members 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_write_project_team_members" 
ON public.project_team_members 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =============================================
-- RLS POLICIES - PROJECTS
-- =============================================

CREATE POLICY "authenticated_read_projects" 
ON public.projects 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_write_projects" 
ON public.projects 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =============================================
-- RLS POLICIES - PROJECT TASKS
-- =============================================

CREATE POLICY "authenticated_read_project_tasks" 
ON public.project_tasks 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_write_project_tasks" 
ON public.project_tasks 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =============================================
-- RLS POLICIES - PROJECT TASK SUBTASKS
-- =============================================

CREATE POLICY "authenticated_read_project_task_subtasks" 
ON public.project_task_subtasks 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_write_project_task_subtasks" 
ON public.project_task_subtasks 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =============================================
-- RLS POLICIES - PROJECT TASK COMMENTS
-- =============================================

CREATE POLICY "authenticated_read_project_task_comments" 
ON public.project_task_comments 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_write_project_task_comments" 
ON public.project_task_comments 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_project_teams_updated_at
BEFORE UPDATE ON public.project_teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_task_subtasks_updated_at
BEFORE UPDATE ON public.project_task_subtasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_task_comments_updated_at
BEFORE UPDATE ON public.project_task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TRIGGER FOR TIME SPENT CALCULATION
-- =============================================

CREATE OR REPLACE FUNCTION public.update_task_time_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.project_tasks 
    SET time_spent_minutes = COALESCE((
      SELECT SUM(time_spent_minutes) 
      FROM public.project_task_subtasks 
      WHERE task_id = OLD.task_id
    ), 0)
    WHERE id = OLD.task_id;
    RETURN OLD;
  ELSE
    UPDATE public.project_tasks 
    SET time_spent_minutes = COALESCE((
      SELECT SUM(time_spent_minutes) 
      FROM public.project_task_subtasks 
      WHERE task_id = NEW.task_id
    ), 0)
    WHERE id = NEW.task_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER subtask_time_update
AFTER INSERT OR UPDATE OF time_spent_minutes OR DELETE
ON public.project_task_subtasks
FOR EACH ROW
EXECUTE FUNCTION public.update_task_time_spent();