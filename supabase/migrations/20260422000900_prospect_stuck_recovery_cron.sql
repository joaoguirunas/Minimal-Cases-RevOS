-- ============================================================
-- Prospect PRO™ — pg_cron: stuck campaign recovery
--
-- Marks campaigns stuck in 'running' for more than 3 minutes
-- as 'error'. Runs every 5 minutes.
-- ============================================================

SELECT cron.schedule(
  'prospect-stuck-recovery',
  '*/5 * * * *',
  $$
    UPDATE prospect_campaigns
    SET status = 'error', updated_at = now()
    WHERE status = 'running'
      AND updated_at < now() - interval '3 minutes';
  $$
);
