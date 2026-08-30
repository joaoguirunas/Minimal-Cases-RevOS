-- ADM-V3-10: Soft-delete columns + pg_cron purge job for adm_clients
-- Idempotent — safe to re-run on a fresh control plane

ALTER TABLE adm_clients
  ADD COLUMN IF NOT EXISTS deleted_at           timestamptz,
  ADD COLUMN IF NOT EXISTS delete_requested_by  uuid;

-- Index for cron purge query (finds clients past grace period)
CREATE INDEX IF NOT EXISTS adm_clients_deleted_at_idx
  ON adm_clients (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- pg_cron: purge tenants past 30-day grace period — runs daily at 04:00 UTC
SELECT cron.unschedule('adm_purge_deleted');

SELECT cron.schedule(
  'adm_purge_deleted',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/adm-purge-tenant',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  );
  $$
);
