-- =====================================================================================
-- WEBHOOKS RESTRUCTURE — Remove novo_lead, add pipeline/stage filtering, DB trigger
-- =====================================================================================

-- 1. Remove webhook_logs for novo_lead webhooks first (FK constraint)
DELETE FROM public.webhook_logs
WHERE webhook_id IN (
  SELECT id FROM public.webhooks WHERE event_type = 'novo_lead'
);

-- 2. Remove novo_lead webhooks
DELETE FROM public.webhooks WHERE event_type = 'novo_lead';

-- 3. Update event_type constraint (remove novo_lead, keep remaining 4 types)
ALTER TABLE public.webhooks
  DROP CONSTRAINT IF EXISTS webhooks_event_type_check,
  DROP CONSTRAINT IF EXISTS check_event_type;

ALTER TABLE public.webhooks
  ADD CONSTRAINT webhooks_event_type_check
  CHECK (event_type IN ('conversa', 'disparo', 'lead_etapa', 'followup'));

COMMENT ON COLUMN public.webhooks.event_type IS
  'Tipo de evento: conversa|disparo|lead_etapa|followup';

-- 4. Add pipeline_id and stage_ids to webhooks for lead_etapa filtering
ALTER TABLE public.webhooks
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.webhooks.pipeline_id IS
  'Para lead_etapa: filtra por pipeline (NULL = todos os pipelines)';
COMMENT ON COLUMN public.webhooks.stage_ids IS
  'Para lead_etapa: array de stage IDs (vazio = todas as etapas)';

-- 5. Enable pg_net extension (Supabase projects have it available)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- 6. Create trigger function to dispatch lead_etapa webhooks via edge function
-- NOTE: For the trigger to work, set these in your Supabase dashboard SQL editor:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR-PROJECT.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
CREATE OR REPLACE FUNCTION public.notify_lead_etapa_changed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
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

  -- Silently skip if settings not configured (avoids breaking lead updates)
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

-- 7. Create/replace trigger on leads table
DROP TRIGGER IF EXISTS on_lead_stage_changed ON public.leads;

CREATE TRIGGER on_lead_stage_changed
  AFTER INSERT OR UPDATE OF leads_stages_id
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lead_etapa_changed();
