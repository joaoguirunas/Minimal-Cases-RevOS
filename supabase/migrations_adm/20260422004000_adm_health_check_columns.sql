-- ADM-V3-09: Health check columns and pg_cron job for automated health polling
-- Idempotent — safe to re-run on a fresh control plane

-- ── 1. Add health check columns to adm_clients ───────────────────────────────
ALTER TABLE adm_clients
  ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_status   text
    CHECK (last_health_status IN ('healthy', 'degraded', 'down', 'unknown'));

-- Index for quick lookup of unhealthy clients
CREATE INDEX IF NOT EXISTS adm_clients_health_status_idx
  ON adm_clients (last_health_status)
  WHERE last_health_status IS NOT NULL;

-- ── 2. pg_cron: run adm-health-check-batch every 30 minutes ─────────────────
-- Requires pg_cron and pg_net extensions (both enabled on control plane)
-- Upsert via cron.unschedule + cron.schedule for idempotency (IF NOT EXISTS
-- is not available in pg_cron — unschedule is a no-op if job does not exist)

SELECT cron.unschedule('adm_health_check_batch');

SELECT cron.schedule(
  'adm_health_check_batch',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/adm-health-check-batch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  );
  $$
);
