-- LP PRO™ Automation Log
-- LPRO-4.2: Ecosystem Automation Triggers
-- Stores execution records for automation rules triggered on form submission

CREATE TABLE IF NOT EXISTS public.lp_automation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID REFERENCES public.lp_pages(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES public.lp_automation_rules(id) ON DELETE SET NULL,
  rule_name       TEXT NOT NULL,
  lead_id         TEXT,                    -- references leads.id (loosely typed — no hard FK)
  submission_id   UUID REFERENCES public.lp_submissions(id) ON DELETE SET NULL,
  conditions_matched JSONB DEFAULT '[]'::jsonb,
  actions_executed   JSONB DEFAULT '[]'::jsonb,
  executed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_automation_log_page
  ON public.lp_automation_log(page_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_lp_automation_log_rule
  ON public.lp_automation_log(rule_id);

ALTER TABLE public.lp_automation_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'lp_automation_log'
      AND policyname = 'admin_gestor_can_manage_automation_log'
  ) THEN
    CREATE POLICY "admin_gestor_can_manage_automation_log"
      ON public.lp_automation_log
      FOR ALL
      TO authenticated
      USING (is_admin_or_gestor());
  END IF;
END $$;
