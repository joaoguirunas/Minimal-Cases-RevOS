-- O cron do worker de follow-ups apontava para o projeto Supabase do template RevOS
-- (wotuyxscsfralqpoiyfv), herdado do clone: toda invocação batia em outro projeto e
-- voltava 401 UNAUTHORIZED_LEGACY_JWT, então a esteira nunca disparou sozinha.
-- Passa a montar a URL a partir de _app_config.supabase_url, como as demais
-- trigger_* functions já fazem, mantendo secure_http_post pela auditoria da chave.
BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_followup_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.followup_queue
    WHERE status = 'pending' AND scheduled_for <= now()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO v_url FROM public._app_config WHERE key = 'supabase_url';
  IF v_url IS NULL THEN
    RAISE WARNING 'trigger_followup_worker: _app_config.supabase_url ausente';
    RETURN;
  END IF;

  PERFORM public.secure_http_post(
    'service_role_cron',
    rtrim(v_url, '/') || '/functions/v1/followup-trigger-worker',
    jsonb_build_object('source', 'pg_cron'),
    'trigger_followup_worker'
  );
END;
$function$;

COMMIT;
