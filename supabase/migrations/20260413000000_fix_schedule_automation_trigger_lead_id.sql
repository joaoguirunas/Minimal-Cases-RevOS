-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: fn_schedule_automation_on_status_change referenced NEW.leads_id
-- Bug: 'record new has no field leads_id' when scheduling meetings
-- Root cause: meetings.leads_id was renamed to lead_id in migration
--   20260227140000_p6_fk_column_consistency, but this trigger (created in
--   20260327180001) still used the old column name.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_schedule_automation_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trigger_status TEXT;
  v_lead_id        UUID;
  v_lead           RECORD;
  v_rule           RECORD;
BEGIN
  -- Only fire on status change (UPDATE) or new meeting (INSERT)
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip bloqueio manual — internal status
  IF NEW.status = 'bloqueio manual' THEN
    RETURN NEW;
  END IF;

  -- Map meetings.status → schedule_automations.trigger_status
  v_trigger_status := CASE NEW.status
    WHEN 'agendado'         THEN 'criado'
    WHEN 'compareceu'       THEN 'realizado'
    WHEN 'cancelado'        THEN 'cancelado'
    WHEN 'não compareceu'   THEN 'no_show'
    WHEN 'confirmado'       THEN 'confirmado'
    WHEN 'reagendado'       THEN 'reagendado'
    ELSE NULL
  END;

  IF v_trigger_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the lead:
  -- 1. Direct FK: meetings.lead_id  (was meetings.leads_id before p6 rename)
  -- 2. Fallback: find lead by meetings.people_id
  v_lead_id := NEW.lead_id;

  IF v_lead_id IS NULL AND NEW.people_id IS NOT NULL THEN
    -- Find the most recent active lead for this person
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE people_id = NEW.people_id
       AND status = 'em-andamento'
       AND archived = false
     ORDER BY updated_at DESC
     LIMIT 1;

    v_lead_id := v_lead.id;
  ELSE
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE id = v_lead_id;
  END IF;

  -- No lead found → nothing to do
  IF v_lead_id IS NULL OR v_lead.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up matching automation rule
  SELECT sa.target_pipeline_id, sa.target_stage_id
    INTO v_rule
    FROM public.schedule_automations sa
   WHERE sa.pipeline_id = v_lead.leads_pipelines_id
     AND sa.trigger_status = v_trigger_status
     AND sa.is_active = true
   LIMIT 1;

  -- No matching rule → nothing to do
  IF v_rule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move the lead: update pipeline + stage
  UPDATE public.leads
     SET leads_pipelines_id = v_rule.target_pipeline_id,
         leads_stages_id    = v_rule.target_stage_id,
         updated_at         = NOW()
   WHERE id = v_lead_id;

  -- Log the move in leads_updates for audit trail
  INSERT INTO public.leads_updates (lead_id, from_stage_id, to_stage_id, notes)
  VALUES (
    v_lead_id,
    v_lead.leads_stages_id,
    v_rule.target_stage_id,
    'Automação Schedule: meeting status → ' || NEW.status
  );

  RETURN NEW;
END;
$$;
