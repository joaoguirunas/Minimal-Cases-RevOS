-- Schedule Automations: pipeline stage moves triggered by appointment status changes
CREATE TABLE IF NOT EXISTS public.schedule_automations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_status    TEXT        NOT NULL
    CHECK (trigger_status IN ('criado', 'confirmado', 'cancelado', 'reagendado', 'realizado', 'no_show')),
  pipeline_id       UUID        NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  target_pipeline_id UUID       NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  target_stage_id   UUID        NOT NULL REFERENCES public.leads_stages(id) ON DELETE CASCADE,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One rule per pipeline + trigger_status
CREATE UNIQUE INDEX schedule_automations_unique_rule
  ON public.schedule_automations (pipeline_id, trigger_status) WHERE is_active = true;

CREATE INDEX schedule_automations_pipeline_idx
  ON public.schedule_automations (pipeline_id, is_active);

ALTER TABLE public.schedule_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all" ON public.schedule_automations;
CREATE POLICY "authenticated_all" ON public.schedule_automations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.schedule_automations TO service_role, authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_schedule_automation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER schedule_automations_updated_at
  BEFORE UPDATE ON public.schedule_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_schedule_automation_updated_at();
