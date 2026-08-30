-- Add missing columns to adm_clients that are referenced by useAdmClients hook
ALTER TABLE public.adm_clients
  ADD COLUMN IF NOT EXISTS management_token_rotated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_check_at          timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_status            text CHECK (last_health_status IN ('healthy','degraded','down','unknown')),
  ADD COLUMN IF NOT EXISTS deleted_at                    timestamptz,
  ADD COLUMN IF NOT EXISTS delete_requested_by           uuid REFERENCES public.settings_users(id) ON DELETE SET NULL;
