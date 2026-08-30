-- Create project_job_functions table
CREATE TABLE public.project_job_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project_job_responsibilities table
CREATE TABLE public.project_job_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_function_id uuid REFERENCES public.project_job_functions(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add job_function_id to project_team_members
ALTER TABLE public.project_team_members 
ADD COLUMN job_function_id uuid REFERENCES public.project_job_functions(id);

-- Enable RLS
ALTER TABLE public.project_job_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_job_responsibilities ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_job_functions
CREATE POLICY "authenticated_read" ON public.project_job_functions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_write" ON public.project_job_functions
FOR ALL TO authenticated
USING (is_admin_or_gestor())
WITH CHECK (is_admin_or_gestor());

-- RLS policies for project_job_responsibilities
CREATE POLICY "authenticated_read" ON public.project_job_responsibilities
FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_write" ON public.project_job_responsibilities
FOR ALL TO authenticated
USING (is_admin_or_gestor())
WITH CHECK (is_admin_or_gestor());

-- Create indexes
CREATE INDEX idx_job_responsibilities_function_id ON public.project_job_responsibilities(job_function_id);
CREATE INDEX idx_team_members_job_function_id ON public.project_team_members(job_function_id);

-- Add trigger for updated_at
CREATE TRIGGER update_project_job_functions_updated_at
BEFORE UPDATE ON public.project_job_functions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();