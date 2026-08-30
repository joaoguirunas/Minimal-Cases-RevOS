-- =============================================================================
-- Migration: P4 — Standardize Portuguese names to English
-- Priority 4: Column renames + function/trigger renames
-- =============================================================================
-- Changes:
--   COLUMNS (6):
--     followup_queue:          mensagem → message, pessoa_id → person_id
--     settings_system_modules: ativo → is_active, ordem → order_index
--     lead_field_definitions:  ordem → order_index
--     lp_automation_rules:     ativo → is_active
--
--   FUNCTIONS (4):
--     is_admin_or_gestor        → is_admin_or_manager
--                                 (old fn kept as wrapper — 57 RLS policies reference it)
--     dispatch_novo_lead_webhooks → dispatch_new_lead_webhooks
--                                 (old fn dropped after trigger replaced)
--     notify_lead_etapa_changed  → notify_lead_stage_changed
--                                 (old fn dropped after trigger replaced)
--     upsert_crm_field_value     → upsert_field_value
--                                 (old fn kept as wrapper for backward compat)
--
--   TRIGGERS (2):
--     trigger_dispatch_novo_lead_webhooks → trigger_dispatch_new_lead_webhooks
--     on_lead_stage_changed (function ref only — trigger name already English)
-- =============================================================================

BEGIN;

-- ============================================================
-- SECTION 1 — Column renames
-- ============================================================

-- followup_queue
ALTER TABLE public.followup_queue RENAME COLUMN mensagem   TO message;
ALTER TABLE public.followup_queue RENAME COLUMN pessoa_id  TO person_id;

-- settings_system_modules
ALTER TABLE public.settings_system_modules RENAME COLUMN ativo  TO is_active;
ALTER TABLE public.settings_system_modules RENAME COLUMN ordem  TO order_index;

-- lead_field_definitions
ALTER TABLE public.lead_field_definitions RENAME COLUMN ordem TO order_index;

-- lp_automation_rules
ALTER TABLE public.lp_automation_rules RENAME COLUMN ativo TO is_active;


-- ============================================================
-- SECTION 2 — is_admin_or_manager (canonical replacement)
--
-- Strategy: create new function with the real body, then redirect the
-- old function to call it. All 57 existing RLS policies remain valid.
-- A future P5 migration will update each policy directly and drop
-- is_admin_or_gestor().
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
  )
$$;

-- Redirect old name → new name (preserves all 57 RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin_or_gestor()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_manager()
$$;


-- ============================================================
-- SECTION 3 — dispatch_new_lead_webhooks
-- ============================================================

CREATE OR REPLACE FUNCTION public.dispatch_new_lead_webhooks()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'net'
AS $$
DECLARE
  webhook_record RECORD;
  payload        JSONB;
  client_data    JSONB;
  request_id     BIGINT;
BEGIN
  -- Fetch client data if people_id exists
  IF NEW.people_id IS NOT NULL THEN
    SELECT to_jsonb(cp.*) INTO client_data
    FROM public.clients_people cp
    WHERE cp.id = NEW.people_id;
  END IF;

  -- Build payload
  payload := jsonb_build_object(
    'tipo',      'novo_lead',
    'timestamp', now(),
    'lead',      to_jsonb(NEW),
    'cliente',   COALESCE(client_data, '{}'::jsonb)
  );

  -- Iterate over active webhooks of type 'novo_lead'
  FOR webhook_record IN
    SELECT id, url, name
    FROM public.webhooks
    WHERE event_type = 'novo_lead' AND active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url                  := webhook_record.url,
        body                 := payload,
        params               := '{}'::jsonb,
        headers              := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 10000
      ) INTO request_id;

      INSERT INTO public.webhook_logs (
        webhook_id, status_code, response_body, request_body, created_at
      ) VALUES (
        webhook_record.id,
        202,
        jsonb_build_object('queued', true, 'request_id', request_id),
        payload,
        now()
      );

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.webhook_logs (
        webhook_id, status_code, response_body, request_body, created_at
      ) VALUES (
        webhook_record.id,
        500,
        jsonb_build_object('error', SQLERRM, 'queued', false),
        payload,
        now()
      );
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Replace trigger
DROP TRIGGER IF EXISTS trigger_dispatch_novo_lead_webhooks ON public.leads;

CREATE TRIGGER trigger_dispatch_new_lead_webhooks
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_new_lead_webhooks();

-- Drop old function (no longer referenced by any trigger)
DROP FUNCTION IF EXISTS public.dispatch_novo_lead_webhooks();


-- ============================================================
-- SECTION 4 — notify_lead_stage_changed
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_lead_stage_changed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  -- Only fire when stage actually changes (skip if unchanged on UPDATE)
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN
    RETURN NEW;
  END IF;

  -- Skip if no stage assigned
  IF NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_key  := current_setting('app.service_role_key', true);

  -- Silently skip if settings not configured
  IF v_supabase_url IS NULL OR v_supabase_url = ''
     OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  -- Fire edge function asynchronously (non-blocking via pg_net)
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block lead updates due to webhook failures
  RETURN NEW;
END;
$$;

-- Replace trigger (name already English, only function ref changes)
DROP TRIGGER IF EXISTS on_lead_stage_changed ON public.leads;

CREATE TRIGGER on_lead_stage_changed
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_stage_changed();

-- Drop old function
DROP FUNCTION IF EXISTS public.notify_lead_etapa_changed();


-- ============================================================
-- SECTION 5 — upsert_field_value (canonical name)
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_field_value(
  p_person_id uuid,
  p_field_key text,
  p_value     text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_definition_id UUID;
BEGIN
  SELECT id INTO v_definition_id
  FROM public.lead_field_definitions
  WHERE key = p_field_key
    AND entity_type = 'pessoa'
    AND active = true
  LIMIT 1;

  IF v_definition_id IS NULL THEN
    RAISE WARNING 'upsert_field_value: field_key "%" not found in lead_field_definitions (entity_type=pessoa)', p_field_key;
    RETURN;
  END IF;

  INSERT INTO public.lead_field_values (
    entity_type, entity_id, field_definition_id, value_text
  )
  VALUES ('pessoa', p_person_id, v_definition_id, p_value)
  ON CONFLICT ON CONSTRAINT lead_field_values_entity_def_uniq
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
END;
$$;

-- Keep old name as a thin wrapper for backward compatibility
-- (app code, n8n flows, and external callers still work without changes)
CREATE OR REPLACE FUNCTION public.upsert_crm_field_value(
  p_person_id uuid,
  p_field_key text,
  p_value     text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.upsert_field_value(p_person_id, p_field_key, p_value);
END;
$$;

COMMIT;
