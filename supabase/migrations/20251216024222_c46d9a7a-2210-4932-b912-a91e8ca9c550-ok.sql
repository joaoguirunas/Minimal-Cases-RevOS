-- Add sort_order to project_team_members for ordering
ALTER TABLE public.project_team_members ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;