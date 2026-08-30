-- ============================================================
-- Migration: Conversion Event Rules (v2)
-- Replaces simple stage_mappings with flexible rule-based triggers
-- Supports: stage_enter, lead_won, lead_lost, lead_created, booking_status
-- ============================================================

-- ============================================================
-- 1. New flexible rules table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversion_event_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,

  -- Trigger definition
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'stage_enter',
    'lead_won',
    'lead_lost',
    'lead_created',
    'booking_status'
  )),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  -- stage_enter:    { pipeline_id, stage_id, stage_name }
  -- booking_status: { status: 'compareceu' | 'nao_compareceu' | 'agendado' | 'cancelado' }
  -- lead_won/lost/created: {} (no config needed)

  -- Meta CAPI
  meta_enabled boolean NOT NULL DEFAULT false,
  meta_pixel_id text,
  meta_event_name text,
  meta_send_value boolean NOT NULL DEFAULT false,

  -- Google Ads
  google_enabled boolean NOT NULL DEFAULT false,
  google_account_id text,
  google_conversion_action_id text,
  google_conversion_action_name text,
  google_send_value boolean NOT NULL DEFAULT false,
  google_currency text NOT NULL DEFAULT 'BRL',

  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversion_event_rules IS 'Flexible conversion event rules: maps CRM events to ad platform conversion events';

ALTER TABLE public.conversion_event_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own conversion rules" ON public.conversion_event_rules;
CREATE POLICY "Users can manage own conversion rules"
  ON public.conversion_event_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Update trigger function to check rules instead of stage_mappings
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
END;
$$;

-- ============================================================
-- 3. Drop old trigger and create new ones
-- ============================================================
DROP TRIGGER IF EXISTS trg_conversion_on_stage_change ON public.leads;

-- Stage change trigger
CREATE TRIGGER trg_conversion_stage_enter
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  WHEN (OLD.leads_stages_id IS DISTINCT FROM NEW.leads_stages_id)
  EXECUTE FUNCTION public.fn_queue_conversion_event('stage_change');

-- Lead won trigger (won_at gets set)
CREATE TRIGGER trg_conversion_lead_won
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  WHEN (OLD.won_at IS NULL AND NEW.won_at IS NOT NULL)
  EXECUTE FUNCTION public.fn_queue_conversion_event('lead_won');

-- Lead lost trigger (lost_at gets set)
CREATE TRIGGER trg_conversion_lead_lost
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  WHEN (OLD.lost_at IS NULL AND NEW.lost_at IS NOT NULL)
  EXECUTE FUNCTION public.fn_queue_conversion_event('lead_lost');

-- ============================================================
-- 4. Booking status trigger (on meetings table)
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
  SELECT l.*, su.auth_user_id AS owner_user_id INTO v_lead
  FROM public.leads l
  LEFT JOIN public.settings_users su ON su.id = l.user_id
  WHERE l.id = NEW.leads_id;

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
END;
$$;

DROP TRIGGER IF EXISTS trg_conversion_booking_status ON public.meetings;

CREATE TRIGGER trg_conversion_booking_status
  AFTER UPDATE OF status ON public.meetings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_queue_conversion_booking();
