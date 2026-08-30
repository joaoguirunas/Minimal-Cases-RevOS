-- Create project_status_updates table for tracking project health and status updates
CREATE TABLE public.project_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.settings_users(id),
  health_status TEXT NOT NULL CHECK (health_status IN ('on-track', 'delayed', 'on-risk')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_status_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (similar to project_comments)
CREATE POLICY "status_updates_select_team_member"
ON public.project_status_updates
FOR SELECT
USING (
  is_admin_or_gestor() OR 
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_status_updates.project_id 
    AND is_team_member(p.team_id)
  ))
);

CREATE POLICY "status_updates_insert_team_member"
ON public.project_status_updates
FOR INSERT
WITH CHECK (
  is_admin_or_gestor() OR 
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_status_updates.project_id 
    AND is_team_admin_or_member(p.team_id)
  ))
);

CREATE POLICY "status_updates_update_author"
ON public.project_status_updates
FOR UPDATE
USING (user_id = get_current_settings_user_id())
WITH CHECK (user_id = get_current_settings_user_id());

CREATE POLICY "status_updates_delete_author"
ON public.project_status_updates
FOR DELETE
USING (user_id = get_current_settings_user_id());

-- Create trigger for updated_at
CREATE TRIGGER update_project_status_updates_updated_at
  BEFORE UPDATE ON public.project_status_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();