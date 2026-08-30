-- =============================================================================
-- FIX: P6 column rename aftermath — 3 broken trigger functions
-- =============================================================================
-- Migration 20260227140000 (P6) renamed columns:
--   leads.users_id → user_id
--   leads_updates.leads_id → lead_id
--   leads_updates.users_id → user_id
--   meetings.leads_id → lead_id
--
-- 3 trigger functions were NOT updated:
--   1. track_leads_changes() — inserts with old column names into leads_updates
--   2. fn_queue_conversion_event() — references NEW.users_id on leads table
--   3. fn_queue_conversion_booking() — references NEW.leads_id on meetings table
--
-- Impact: ALL updates to leads table fail (stage, value, status, etc.)
-- =============================================================================


-- ============================================================
-- FIX 1: track_leads_changes() — PRIMARY BLOCKER
-- Old function referenced: leads_id, changed_by, changed_at,
-- field_name, old_value, new_value, change_type
-- Current leads_updates schema: lead_id, user_id, from_stage_id,
-- to_stage_id, notes, created_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.track_leads_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track stage changes with from/to stage IDs
    IF OLD.leads_stages_id IS DISTINCT FROM NEW.leads_stages_id THEN
      INSERT INTO leads_updates (
        lead_id,
        user_id,
        from_stage_id,
        to_stage_id,
        notes,
        created_at
      ) VALUES (
        NEW.id,
        (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
        OLD.leads_stages_id,
        NEW.leads_stages_id,
        'stage_change',
        NOW()
      );
    END IF;

    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO leads_updates (
        lead_id,
        user_id,
        notes,
        created_at
      ) VALUES (
        NEW.id,
        (SELECT id FROM settings_users WHERE auth_user_id = auth.uid() LIMIT 1),
        'status_change: ' || COALESCE(OLD.status, 'null') || ' → ' || COALESCE(NEW.status, 'null'),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- NEVER block lead updates due to audit trail failures
  RAISE WARNING 'track_leads_changes failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- FIX 2: fn_queue_conversion_event() — NEW.users_id → NEW.user_id
-- Also add outer EXCEPTION to never block lead updates
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_queue_conversion_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_person record;
  v_email_hash text;
  v_phone_hash text;
  v_lead_user_id uuid;
  v_rule record;
  v_event_type text;
BEGIN
  -- Resolve the owner (user_id) of this lead via settings_users
  -- FIX: was NEW.users_id, column renamed to user_id by P6
  SELECT su.auth_user_id INTO v_lead_user_id
  FROM public.settings_users su
  WHERE su.id = NEW.user_id;

  IF v_lead_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine event type
  IF TG_ARGV[0] = 'stage_change' THEN
    v_event_type := 'stage_enter';
  ELSIF TG_ARGV[0] = 'lead_won' THEN
    v_event_type := 'lead_won';
  ELSIF TG_ARGV[0] = 'lead_lost' THEN
    v_event_type := 'lead_lost';
  ELSE
    v_event_type := 'stage_enter';
  END IF;

  -- Fetch person data for hashing
  IF NEW.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people
    WHERE id = NEW.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Find matching rules
  FOR v_rule IN
    SELECT id, name, trigger_type, trigger_config, meta_enabled, meta_event_name, meta_send_value,
           google_enabled, google_conversion_action_id, google_send_value, google_currency,
           meta_pixel_id, google_account_id
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND (meta_enabled = true OR google_enabled = true)
      AND trigger_type = v_event_type
  LOOP
    -- Check trigger_config match
    IF v_event_type = 'stage_enter' AND (v_rule.trigger_config->>'stage_id') IS NOT NULL THEN
      IF (v_rule.trigger_config->>'stage_id') <> NEW.leads_stages_id::text THEN
        CONTINUE;
      END IF;
    END IF;

    -- Insert queue entry for this matched rule
    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      NEW.id,
      NEW.leads_stages_id,
      COALESCE(NEW.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',      v_rule.id::text,
        'rule_name',    v_rule.name,
        'trigger_type', v_rule.trigger_type,
        'gclid',        NEW.gclid,
        'fbclid',       NEW.fbclid,
        'fbc',          NEW.fbc,
        'fbp',          NEW.fbp,
        'fb_lead_id',   NEW.fb_lead_id,
        'email_hash',   v_email_hash,
        'phone_hash',   v_phone_hash,
        'value',        NEW.value,
        'timestamp',    extract(epoch from now())::bigint,
        -- Meta-specific
        'meta_pixel_id',     v_rule.meta_pixel_id,
        'meta_event_name',   v_rule.meta_event_name,
        'meta_send_value',   v_rule.meta_send_value,
        -- Google-specific
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- Fire-and-forget: invoke conversion-send edge function
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block lead updates
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: NEVER block lead updates due to conversion tracking
  RAISE WARNING 'fn_queue_conversion_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- ============================================================
-- FIX 3: fn_queue_conversion_booking() — NEW.leads_id → NEW.lead_id
-- meetings.leads_id was renamed to lead_id by P6
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_queue_conversion_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead record;
  v_person record;
  v_email_hash text;
  v_phone_hash text;
  v_lead_user_id uuid;
  v_rule record;
  v_normalized_status text;
BEGIN
  -- Normalize status
  v_normalized_status := CASE NEW.status
    WHEN 'agendada'   THEN 'agendado'
    WHEN 'cancelada'  THEN 'cancelado'
    WHEN 'realizada'  THEN 'compareceu'
    ELSE NEW.status
  END;

  -- Get the lead associated with this meeting
  -- FIX: was NEW.leads_id, column renamed to lead_id by P6
  SELECT l.*, su.auth_user_id AS owner_user_id INTO v_lead
  FROM public.leads l
  LEFT JOIN public.settings_users su ON su.id = l.user_id
  WHERE l.id = NEW.lead_id;

  IF v_lead IS NULL OR v_lead.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_lead_user_id := v_lead.owner_user_id;

  -- Hash person data
  IF v_lead.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people WHERE id = v_lead.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Find matching booking_status rules
  FOR v_rule IN
    SELECT *
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND trigger_type = 'booking_status'
      AND (meta_enabled = true OR google_enabled = true)
      AND (trigger_config->>'status') = v_normalized_status
  LOOP
    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      v_lead.id,
      v_lead.leads_stages_id,
      COALESCE(v_lead.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',        v_rule.id::text,
        'rule_name',      v_rule.name,
        'trigger_type',   'booking_status',
        'booking_status', v_normalized_status,
        'meeting_id',     NEW.id::text,
        'gclid',          v_lead.gclid,
        'fbclid',         v_lead.fbclid,
        'fbc',            v_lead.fbc,
        'fbp',            v_lead.fbp,
        'fb_lead_id',     v_lead.fb_lead_id,
        'email_hash',     v_email_hash,
        'phone_hash',     v_phone_hash,
        'value',          v_lead.value,
        'timestamp',      extract(epoch from now())::bigint,
        'meta_pixel_id',               v_rule.meta_pixel_id,
        'meta_event_name',             v_rule.meta_event_name,
        'meta_send_value',             v_rule.meta_send_value,
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- Fire conversion-send
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: NEVER block meeting updates due to conversion tracking
  RAISE WARNING 'fn_queue_conversion_booking failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
