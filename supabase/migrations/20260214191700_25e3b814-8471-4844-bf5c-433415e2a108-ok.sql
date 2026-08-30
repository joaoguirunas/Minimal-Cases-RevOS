
-- Drop AIOS tables (respecting FK order)
DROP TABLE IF EXISTS public.aios_reports CASCADE;
DROP TABLE IF EXISTS public.aios_tasks CASCADE;
DROP TABLE IF EXISTS public.aios_agents CASCADE;

-- Drop open-source modules table
DROP TABLE IF EXISTS public.settings_open_source_modules CASCADE;

-- Drop site-related tables used by open-source portal
DROP TABLE IF EXISTS public.site_cases_nichos_relacionamento CASCADE;
DROP TABLE IF EXISTS public.site_cases_nichos CASCADE;
DROP TABLE IF EXISTS public.site_profiles CASCADE;

-- Drop related functions (excluding handle_new_user which has auth trigger)
DROP FUNCTION IF EXISTS public.get_all_nichos();
DROP FUNCTION IF EXISTS public.create_nicho(text, text, text);
DROP FUNCTION IF EXISTS public.update_nicho(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.delete_nicho(uuid);
DROP FUNCTION IF EXISTS public.get_available_nichos();
DROP FUNCTION IF EXISTS public.remove_nicho_from_case(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_case_nichos(uuid);
DROP FUNCTION IF EXISTS public.add_nicho_to_case(uuid, uuid);

-- Drop orphaned project-related functions
DROP FUNCTION IF EXISTS public.update_task_time_spent() CASCADE;
DROP FUNCTION IF EXISTS public.client_can_edit_tasks(uuid);
DROP FUNCTION IF EXISTS public.client_can_create_tasks(uuid);
DROP FUNCTION IF EXISTS public.client_can_comment(uuid);
DROP FUNCTION IF EXISTS public.client_has_team_access(uuid);
DROP FUNCTION IF EXISTS public.is_client_user();
DROP FUNCTION IF EXISTS public.get_user_team_role(uuid);
DROP FUNCTION IF EXISTS public.move_task(uuid, text, integer);
DROP FUNCTION IF EXISTS public.get_project_task_counts(uuid);
DROP FUNCTION IF EXISTS public.get_project_dashboard_stats(uuid, uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_project_user_ranking(uuid, date, date, integer);
DROP FUNCTION IF EXISTS public.update_aios_agents_updated_at() CASCADE;
