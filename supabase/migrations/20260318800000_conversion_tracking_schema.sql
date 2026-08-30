-- ============================================================
-- Migration: Conversion Tracking Schema
-- Story: conversion-loop.1 — Offline Conversion Tracking
-- Fase 1: Tasks 1-5
-- ============================================================

-- ============================================================
-- Task 1A: Novas colunas em leads (gclid/fbclid/fb_lead_id já existem)
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS lead_source text;

COMMENT ON COLUMN public.leads.fbc IS 'Meta fbc cookie value (fb.1.{ts}.{fbclid}) for CAPI matching';
COMMENT ON COLUMN public.leads.fbp IS 'Meta fbp cookie value (browser ID) for CAPI matching';
COMMENT ON COLUMN public.leads.lead_source IS 'Lead origin: site_form, meta_lead_ad, whatsapp, manual, organic';

-- ============================================================
-- Task 1B: Novas colunas em form_pro_submissions
-- ============================================================
ALTER TABLE public.form_pro_submissions
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS meta_leadgen_id text,
  ADD COLUMN IF NOT EXISTS meta_adgroup_id text;

COMMENT ON COLUMN public.form_pro_submissions.gclid IS 'Google Ads click ID captured from URL';
COMMENT ON COLUMN public.form_pro_submissions.fbclid IS 'Facebook click ID captured from URL';
COMMENT ON COLUMN public.form_pro_submissions.fbc IS 'Meta fbc cookie value for CAPI';
COMMENT ON COLUMN public.form_pro_submissions.fbp IS 'Meta fbp browser ID cookie for CAPI';
COMMENT ON COLUMN public.form_pro_submissions.meta_leadgen_id IS 'Meta Lead Ads leadgen_id (used as lead_id in CAPI)';
COMMENT ON COLUMN public.form_pro_submissions.meta_adgroup_id IS 'Meta ad-level ID from leadgen webhook';

-- ============================================================
-- Task 2: conversion_platform_credentials
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversion_platform_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta', 'google')),
  credentials jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_platform UNIQUE (user_id, platform)
);

COMMENT ON TABLE public.conversion_platform_credentials IS 'Ad platform credentials for conversion tracking (Meta CAPI, Google Ads)';
COMMENT ON COLUMN public.conversion_platform_credentials.credentials IS 'Meta: {pixel_id, access_token, test_event_code}. Google: {customer_id, developer_token, oauth_refresh_token, login_customer_id, conversion_action}';

ALTER TABLE public.conversion_platform_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own credentials" ON public.conversion_platform_credentials;
CREATE POLICY "Users can manage own credentials"
  ON public.conversion_platform_credentials
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Task 3: conversion_stage_mappings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversion_stage_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.leads_stages(id) ON DELETE CASCADE,

  -- Meta CAPI
  meta_enabled boolean NOT NULL DEFAULT false,
  meta_event_name text,
  meta_send_value boolean NOT NULL DEFAULT false,

  -- Google Ads
  google_enabled boolean NOT NULL DEFAULT false,
  google_conversion_action text,
  google_send_value boolean NOT NULL DEFAULT false,
  google_currency text NOT NULL DEFAULT 'BRL',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_stage UNIQUE (user_id, stage_id)
);

COMMENT ON TABLE public.conversion_stage_mappings IS 'Maps pipeline stages to ad platform conversion events';

ALTER TABLE public.conversion_stage_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own stage mappings" ON public.conversion_stage_mappings;
CREATE POLICY "Users can manage own stage mappings"
  ON public.conversion_stage_mappings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Task 4: conversion_events_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversion_events_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.leads_stages(id) ON DELETE CASCADE,
  lead_source text,

  event_data jsonb NOT NULL DEFAULT '{}',

  -- Meta CAPI status
  meta_status text NOT NULL DEFAULT 'pending'
    CHECK (meta_status IN ('pending', 'sent', 'failed', 'skipped')),
  meta_response jsonb,
  meta_sent_at timestamptz,

  -- Google Ads status
  google_status text NOT NULL DEFAULT 'pending'
    CHECK (google_status IN ('pending', 'sent', 'failed', 'skipped')),
  google_response jsonb,
  google_sent_at timestamptz,

  skip_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversion_events_queue IS 'Queue for ad platform conversion events triggered by lead stage changes';

-- Partial index for efficient pending processing
CREATE INDEX IF NOT EXISTS idx_conv_queue_pending
  ON public.conversion_events_queue (created_at)
  WHERE meta_status = 'pending' OR google_status = 'pending';

-- Index for lead history lookup
CREATE INDEX IF NOT EXISTS idx_conv_queue_lead
  ON public.conversion_events_queue (lead_id, created_at DESC);

ALTER TABLE public.conversion_events_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversion events" ON public.conversion_events_queue;
CREATE POLICY "Users can view own conversion events"
  ON public.conversion_events_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role needs full access for edge function processing
DROP POLICY IF EXISTS "Service role full access on conversion_events_queue" ON public.conversion_events_queue;
CREATE POLICY "Service role full access on conversion_events_queue"
  ON public.conversion_events_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Task 5: Trigger function + trigger on leads stage change
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
BEGIN
  -- Resolve the owner (user_id) of this lead via settings_users
  SELECT su.auth_user_id INTO v_lead_user_id
  FROM public.settings_users su
  WHERE su.id = NEW.user_id;

  -- If no user found, try the lead's team or skip
  IF v_lead_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch person data for hashing
  IF NEW.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people
    WHERE id = NEW.people_id;

    -- SHA-256 hashes for Meta CAPI + Google Enhanced Conversions
    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(
        digest(lower(trim(v_person.email)), 'sha256'), 'hex'
      );
    END IF;

    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(
        digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex'
      );
    END IF;
  END IF;

  INSERT INTO public.conversion_events_queue (
    user_id,
    lead_id,
    stage_id,
    lead_source,
    event_data
  ) VALUES (
    v_lead_user_id,
    NEW.id,
    NEW.leads_stages_id,
    COALESCE(NEW.lead_source, 'unknown'),
    jsonb_build_object(
      'gclid',        NEW.gclid,
      'fbclid',       NEW.fbclid,
      'fbc',          NEW.fbc,
      'fbp',          NEW.fbp,
      'fb_lead_id',   NEW.fb_lead_id,
      'email_hash',   v_email_hash,
      'phone_hash',   v_phone_hash,
      'value',        NEW.value,
      'old_stage_id', OLD.leads_stages_id::text,
      'new_stage_id', NEW.leads_stages_id::text,
      'timestamp',    extract(epoch from now())::bigint
    )
  );

  -- Fire-and-forget: invoke conversion-send edge function via pg_net
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- pg_net failure should never block the lead stage update
    RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_conversion_on_stage_change ON public.leads;

CREATE TRIGGER trg_conversion_on_stage_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  WHEN (OLD.leads_stages_id IS DISTINCT FROM NEW.leads_stages_id)
  EXECUTE FUNCTION public.fn_queue_conversion_event();

-- ============================================================
-- Task 14: Cron job for retry processing (every 5 minutes)
-- Catches events where pg_net failed or API returned error
-- ============================================================
SELECT cron.schedule(
  'conversion-send-retry',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
