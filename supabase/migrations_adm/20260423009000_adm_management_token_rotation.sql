-- ADM-V3-05: Management token rotation tracking

ALTER TABLE adm_clients
  ADD COLUMN IF NOT EXISTS management_token_rotated_at timestamptz;

-- adm_audit_log must exist (created in baseline); ensure action index covers token events
CREATE INDEX IF NOT EXISTS idx_adm_audit_log_action ON adm_audit_log(action, created_at DESC);

-- pg_cron: weekly rotation trigger (Sundays 02:00 UTC)
-- The job calls the adm-rotate-management-token edge fn for every active client.
-- Requires pg_net for HTTP calls within the DB; if not available, trigger via external scheduler.
SELECT cron.schedule(
  'adm_rotate_tokens',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.control_plane_functions_url') || '/adm-rotate-management-token',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('rotate_all_active', true)
  )
  FROM adm_clients
  WHERE status = 'active'
  LIMIT 1
  $$
);
