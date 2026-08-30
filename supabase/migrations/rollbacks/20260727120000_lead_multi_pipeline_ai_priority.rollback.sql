DROP FUNCTION IF EXISTS public.add_lead_to_pipeline(uuid, uuid);

ALTER TABLE public.leads_stages
  DROP COLUMN IF EXISTS ai_priority;
