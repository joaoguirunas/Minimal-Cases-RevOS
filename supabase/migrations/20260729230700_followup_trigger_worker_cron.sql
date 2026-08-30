BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_followup_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.followup_queue
    WHERE status = 'pending' AND scheduled_for <= now()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  PERFORM public.secure_http_post(
    'service_role_cron',
    'https://wotuyxscsfralqpoiyfv.supabase.co/functions/v1/followup-trigger-worker',
    jsonb_build_object('source', 'pg_cron'),
    'trigger_followup_worker'
  );
END;
$$;

COMMENT ON FUNCTION public.trigger_followup_worker() IS
  'Chamada pelo pg_cron a cada minuto. Só invoca followup-trigger-worker quando há entradas pending vencidas na fila (evita invocações vazias).';

SELECT cron.schedule(
  'followup-trigger-worker-1min',
  '* * * * *',
  $cron$SELECT public.trigger_followup_worker();$cron$
);

-- smoke test
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'followup-trigger-worker-1min';

COMMIT;
