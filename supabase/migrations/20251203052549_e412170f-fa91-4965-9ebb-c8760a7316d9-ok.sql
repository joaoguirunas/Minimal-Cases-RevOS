-- Add new columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS briefing TEXT,
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'on-track';

-- Create project_comments table
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.settings_users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON public.project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_created_at ON public.project_comments(created_at DESC);

-- Enable RLS
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: team members can view
CREATE POLICY "comments_select_team_member" ON public.project_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_comments.project_id 
      AND is_team_member(p.team_id)
    )
  );

-- INSERT: members can create
CREATE POLICY "comments_insert_team_member" ON public.project_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_comments.project_id 
      AND is_team_admin_or_member(p.team_id)
    )
  );

-- UPDATE: only author can edit
CREATE POLICY "comments_update_author" ON public.project_comments
  FOR UPDATE USING (user_id = get_current_settings_user_id())
  WITH CHECK (user_id = get_current_settings_user_id());

-- DELETE: only author can delete
CREATE POLICY "comments_delete_author" ON public.project_comments
  FOR DELETE USING (user_id = get_current_settings_user_id());

-- Trigger for updated_at
CREATE TRIGGER set_project_comments_updated_at
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();