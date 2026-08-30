-- Create project_documents table
CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  link TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES settings_users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "documents_select_team_member"
ON public.project_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id
    AND is_team_member(p.team_id)
  )
);

CREATE POLICY "documents_insert_team_member"
ON public.project_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id
    AND is_team_admin_or_member(p.team_id)
  )
);

CREATE POLICY "documents_update_team_member"
ON public.project_documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id
    AND is_team_admin_or_member(p.team_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id
    AND is_team_admin_or_member(p.team_id)
  )
);

CREATE POLICY "documents_delete_team_member"
ON public.project_documents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id
    AND is_team_admin_or_member(p.team_id)
  )
);

-- Create index for faster queries
CREATE INDEX idx_project_documents_project_id ON public.project_documents(project_id);