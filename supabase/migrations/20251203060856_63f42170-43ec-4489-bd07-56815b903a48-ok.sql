-- Create project_meetings table
CREATE TABLE public.project_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL,
  summary TEXT,
  created_by UUID REFERENCES public.settings_users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_meetings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "meetings_select_team_member" ON public.project_meetings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id
    AND is_team_member(p.team_id)
  )
);

CREATE POLICY "meetings_insert_team_member" ON public.project_meetings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id
    AND is_team_admin_or_member(p.team_id)
  )
);

CREATE POLICY "meetings_update_team_member" ON public.project_meetings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id
    AND is_team_admin_or_member(p.team_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id
    AND is_team_admin_or_member(p.team_id)
  )
);

CREATE POLICY "meetings_delete_team_member" ON public.project_meetings
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id
    AND is_team_admin_or_member(p.team_id)
  )
);

-- Create index for performance
CREATE INDEX idx_project_meetings_project_id ON public.project_meetings(project_id);
CREATE INDEX idx_project_meetings_date ON public.project_meetings(meeting_date DESC);