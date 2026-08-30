-- Schedule Automation Trigger
-- When meetings.status changes, look up schedule_automations rules and move the lead accordingly.
--
-- Mapping: meetings.status (DB) → schedule_automations.trigger_status (config)
--   'agendado'         → 'criado'       (new meeting created/set to agendado)
--   'compareceu'       → 'realizado'    (attended)
--   'cancelado'        → 'cancelado'    (cancelled)
--   'não compareceu'   → 'no_show'      (no-show)
--   'bloqueio manual'  → (no mapping — internal status, not a user action)
--
-- Note: 'confirmado' and 'reagendado' are not canonical meetings.status values yet.
-- When those are added to the meetings CHECK constraint, this trigger will handle them automatically.

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
  -- 1. Direct FK: meetings.leads_id
  -- 2. Fallback: find lead by meetings.people_id
  v_lead_id := NEW.leads_id;

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
  INSERT INTO public.leads_updates (leads_id, from_stage_id, to_stage_id, notes)
  VALUES (
    v_lead_id,
    v_lead.leads_stages_id,
    v_rule.target_stage_id,
    'Automação Schedule: meeting status → ' || NEW.status
  );

  RETURN NEW;
END;
$$;

-- Trigger on INSERT (new meeting) and UPDATE (status change)
DROP TRIGGER IF EXISTS trg_schedule_automation ON public.meetings;
CREATE TRIGGER trg_schedule_automation
  AFTER INSERT OR UPDATE OF status ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_schedule_automation_on_status_change();
