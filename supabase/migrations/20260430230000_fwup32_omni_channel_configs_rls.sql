-- FWUP-32: RLS policies for omni_channel_configs on new tenants.
-- 20260308010001_omni_channel_configs-ok.sql was never added to client-migrations.json
-- so tenants onboarded from the baseline have RLS enabled but no policies —
-- all reads and writes (including tl;dv API key save) were rejected.

DROP POLICY IF EXISTS "omni_channel_configs_read"  ON public.omni_channel_configs;
DROP POLICY IF EXISTS "omni_channel_configs_write" ON public.omni_channel_configs;

CREATE POLICY "omni_channel_configs_read"
  ON public.omni_channel_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "omni_channel_configs_write"
  ON public.omni_channel_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );
