-- ADM-V2-02: Sync timeout — marca jobs stuck como failed
-- Função pode ser chamada manualmente ou via pg_cron (se disponível)

CREATE OR REPLACE FUNCTION adm_timeout_stuck_jobs()
RETURNS INTEGER AS $$
DECLARE
  timed_out_count INTEGER;
BEGIN
  WITH timed_out AS (
    UPDATE adm_sync_jobs
    SET status = 'failed',
        completed_at = now(),
        error_message = 'Timeout: job excedeu 10 minutos'
    WHERE status = 'running'
      AND started_at < now() - interval '10 minutes'
    RETURNING id, client_id
  ),
  client_updates AS (
    UPDATE adm_clients
    SET sync_status = 'error'
    WHERE id IN (SELECT client_id FROM timed_out)
  )
  SELECT count(*) INTO timed_out_count FROM timed_out;

  -- Insert log for each timed out job
  INSERT INTO adm_sync_logs (job_id, level, message)
  SELECT id, 'error', '[' || now()::text || '] Timeout: job excedeu 10 minutos e foi marcado como failed automaticamente'
  FROM adm_sync_jobs
  WHERE status = 'failed'
    AND error_message = 'Timeout: job excedeu 10 minutos'
    AND completed_at >= now() - interval '1 minute';

  RETURN timed_out_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
