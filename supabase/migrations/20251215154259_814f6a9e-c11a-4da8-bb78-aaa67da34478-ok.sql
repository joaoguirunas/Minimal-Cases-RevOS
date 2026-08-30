-- Add levels array to project_job_responsibilities
ALTER TABLE project_job_responsibilities 
ADD COLUMN levels text[] DEFAULT ARRAY['all']::text[];

-- Add level to project_team_members
ALTER TABLE project_team_members 
ADD COLUMN level text DEFAULT 'pleno';

-- Add index for efficient level queries
CREATE INDEX idx_project_team_members_level ON project_team_members(level);

-- Add comment for documentation
COMMENT ON COLUMN project_job_responsibilities.levels IS 'Array of seniority levels this responsibility applies to: junior, pleno, senior, clevel, all';
COMMENT ON COLUMN project_team_members.level IS 'Seniority level of the team member: junior, pleno, senior, clevel';