DROP TRIGGER IF EXISTS leads_stage_duplication_trigger ON public.leads;
DROP FUNCTION IF EXISTS public.duplicate_lead_on_stage_enter();
DROP TABLE IF EXISTS public.leads_stage_duplication_rules;
