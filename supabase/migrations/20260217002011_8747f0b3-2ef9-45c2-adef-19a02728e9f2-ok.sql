
-- Drop overly permissive policies on settings_schedules
DROP POLICY IF EXISTS "authenticated_read" ON public.settings_schedules;
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_schedules;

-- Users can read their own schedules; admins/gestors can read all
CREATE POLICY "users_read_own_schedules" ON public.settings_schedules
FOR SELECT TO authenticated
USING (
  user_id = get_current_settings_user_id()
  OR is_admin_or_gestor()
);

-- Users can insert their own schedules; admins/gestors can insert any
CREATE POLICY "users_insert_schedules" ON public.settings_schedules
FOR INSERT TO authenticated
WITH CHECK (
  user_id = get_current_settings_user_id()
  OR is_admin_or_gestor()
);

-- Users can update their own schedules; admins/gestors can update any
CREATE POLICY "users_update_own_schedules" ON public.settings_schedules
FOR UPDATE TO authenticated
USING (
  user_id = get_current_settings_user_id()
  OR is_admin_or_gestor()
)
WITH CHECK (
  user_id = get_current_settings_user_id()
  OR is_admin_or_gestor()
);

-- Users can delete their own schedules; admins/gestors can delete any
CREATE POLICY "users_delete_own_schedules" ON public.settings_schedules
FOR DELETE TO authenticated
USING (
  user_id = get_current_settings_user_id()
  OR is_admin_or_gestor()
);
