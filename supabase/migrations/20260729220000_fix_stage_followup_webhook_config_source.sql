BEGIN;

CREATE OR REPLACE FUNCTION public.notify_lead_stage_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN
    RETURN NEW;
  END IF;
  IF NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Always cancel pending stage followups from prior stage (no settings needed)
  UPDATE public.followup_queue
  SET status = 'cancelled', fired_at = now(), error_message = 'Cancelado: lead mudou de etapa'
  WHERE lead_id = NEW.id AND status = 'pending' AND source_type = 'stage';

  SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key  FROM public._app_config WHERE key = 'service_role_key';
  IF v_supabase_url IS NULL OR v_supabase_url = '' OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/dispara-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('tipo', 'lead_etapa', 'lead_id', NEW.id::text)
  );
  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/followup-enqueue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('lead_id', NEW.id::text, 'stage_id', NEW.leads_stages_id::text, 'source_type', 'stage')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_followup_retry_worker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stale_threshold timestamptz := now() - interval '15 minutes';
  v_supabase_url text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.followup_queue
    WHERE status = 'queued'
      AND updated_at < v_stale_threshold
      AND retry_count < 3
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN;
  END IF;

  PERFORM public.secure_http_post(
    'service_role_key',
    v_supabase_url || '/functions/v1/followup-retry-worker',
    jsonb_build_object('source', 'pg_cron'),
    'trigger_followup_retry_worker'
  );
END;
$function$;

-- smoke test: confirm both functions now resolve real values instead of NULL
SELECT
  (SELECT value FROM public._app_config WHERE key='supabase_url')     AS app_config_url,
  (SELECT value FROM public._app_config WHERE key='service_role_key' ) IS NOT NULL AS has_service_key;

COMMIT;
