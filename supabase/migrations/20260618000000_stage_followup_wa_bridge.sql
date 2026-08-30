-- Stage → Followup → WA bridge
--
-- 1. Update notify_lead_stage_changed to auto-cancel stale stage followups
--    and call followup-enqueue when a lead enters a new stage.
-- 2. Add "Entrar no WhatsApp" stage to all active pipelines so operators
--    can configure a whatsapp_template followup on it via UI.

-- ── 1. Update trigger function ────────────────────────────────────────────────

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
  -- Only fire when stage actually changes
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN
    RETURN NEW;
  END IF;

  IF NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Always cancel pending stage followups from prior stage (no settings needed)
  UPDATE public.followup_queue
  SET status        = 'cancelled',
      fired_at      = now(),
      error_message = 'Cancelado: lead mudou de etapa'
  WHERE lead_id     = NEW.id
    AND status      = 'pending'
    AND source_type = 'stage';

  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_key  := current_setting('app.service_role_key', true);

  IF v_supabase_url IS NULL OR v_supabase_url = ''
     OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  -- Fire dispara-webhook (lead_etapa event for N8N / webhooks)
  PERFORM extensions.http_post(
    url     := v_supabase_url || '/functions/v1/dispara-webhook',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'tipo',    'lead_etapa',
      'lead_id', NEW.id::text
    )
  );

  -- Enqueue stage followups for the new stage
  PERFORM extensions.http_post(
    url     := v_supabase_url || '/functions/v1/followup-enqueue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'lead_id',     NEW.id::text,
      'stage_id',    NEW.leads_stages_id::text,
      'source_type', 'stage'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block lead updates due to webhook/enqueue failures
  RETURN NEW;
END;
$function$;

-- ── 2. Add "Entrar no WhatsApp" stage to each active pipeline ─────────────────
--    Idempotent: skips if a stage with this name already exists in the pipeline.

DO $$
DECLARE
  r RECORD;
  v_max_order INT;
BEGIN
  FOR r IN
    SELECT id, name FROM public.leads_pipelines WHERE active = true ORDER BY name
  LOOP
    -- Skip if stage already exists
    IF EXISTS (
      SELECT 1 FROM public.leads_stages
      WHERE leads_pipelines_id = r.id AND name = 'Entrar no WhatsApp' AND active = true
    ) THEN
      RAISE NOTICE 'Pipeline "%": stage "Entrar no WhatsApp" já existe, pulando.', r.name;
      CONTINUE;
    END IF;

    -- Find next order_index
    SELECT COALESCE(MAX(order_index), 0) + 1
      INTO v_max_order
      FROM public.leads_stages
     WHERE leads_pipelines_id = r.id;

    INSERT INTO public.leads_stages (
      leads_pipelines_id,
      name,
      color,
      order_index,
      active
    ) VALUES (
      r.id,
      'Entrar no WhatsApp',
      '#25D366',
      v_max_order,
      true
    );

    RAISE NOTICE 'Pipeline "%": stage "Entrar no WhatsApp" criado (order_index=%).', r.name, v_max_order;
  END LOOP;
END;
$$;
