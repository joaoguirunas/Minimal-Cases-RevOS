
-- Drop all project and process related tables (respecting FK order)

-- 1. Project tables (child tables first)
DROP TABLE IF EXISTS client_user_projects CASCADE;
DROP TABLE IF EXISTS project_task_attachments CASCADE;
DROP TABLE IF EXISTS project_task_comments CASCADE;
DROP TABLE IF EXISTS project_task_subtasks CASCADE;
DROP TABLE IF EXISTS project_tasks CASCADE;
DROP TABLE IF EXISTS project_comments CASCADE;
DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS project_meetings CASCADE;
DROP TABLE IF EXISTS project_status_updates CASCADE;
DROP TABLE IF EXISTS project_job_responsibilities CASCADE;
DROP TABLE IF EXISTS project_job_functions CASCADE;
DROP TABLE IF EXISTS project_team_management_links CASCADE;
DROP TABLE IF EXISTS project_team_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS project_teams CASCADE;

-- 2. Process tables (child tables first)
DROP TABLE IF EXISTS process_edges CASCADE;
DROP TABLE IF EXISTS process_nodes CASCADE;
DROP TABLE IF EXISTS process_steps CASCADE;
DROP TABLE IF EXISTS process_subtask_templates CASCADE;
DROP TABLE IF EXISTS process_task_templates CASCADE;
DROP TABLE IF EXISTS process_task_sets CASCADE;
DROP TABLE IF EXISTS process_task_set_categories CASCADE;
DROP TABLE IF EXISTS processes CASCADE;

-- 3. Drop helper functions related to projects
DROP FUNCTION IF EXISTS is_team_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_team_admin_or_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_team_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS client_has_project_access(uuid) CASCADE;
