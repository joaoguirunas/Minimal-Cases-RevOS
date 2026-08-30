-- ============================================================
-- Instagram Automations — ManyChat-style automation engine
-- Tables: instagram_automations + instagram_automation_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.instagram_automations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  description          TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  -- Trigger
  trigger_type         TEXT        NOT NULL
    CHECK (trigger_type IN ('incoming_dm', 'post_comment', 'story_mention', 'story_reply')),
  -- Filters
  filter_operator      TEXT        NOT NULL DEFAULT 'any'
    CHECK (filter_operator IN ('any', 'all')),
  filters              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Action
  action_type          TEXT        NOT NULL
    CHECK (action_type IN ('send_dm', 'reply_comment', 'reply_and_dm')),
  action_dm_text       TEXT,
  action_comment_text  TEXT,
  -- Settings
  cooldown_hours       INTEGER     NOT NULL DEFAULT 24,
  priority             INTEGER     NOT NULL DEFAULT 0,
  -- Meta
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instagram_automation_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id    UUID        REFERENCES public.instagram_automations(id) ON DELETE SET NULL,
  automation_name  TEXT,
  trigger_type     TEXT,
  person_id        UUID        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  person_name      TEXT,
  ig_message_id    TEXT,
  message_text     TEXT,
  filters_matched  JSONB,
  action_executed  TEXT,
  status           TEXT        NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'skipped', 'cooldown')),
  error_message    TEXT,
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS instagram_automations_trigger_idx
  ON public.instagram_automations (trigger_type, is_active, priority);

CREATE INDEX IF NOT EXISTS instagram_automation_log_automation_idx
  ON public.instagram_automation_log (automation_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS instagram_automation_log_person_idx
  ON public.instagram_automation_log (person_id, automation_id, executed_at DESC);

-- RLS
ALTER TABLE public.instagram_automations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_automation_log   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.instagram_automations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all" ON public.instagram_automation_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.instagram_automations     TO service_role, authenticated;
GRANT ALL ON public.instagram_automation_log  TO service_role, authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_instagram_automation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS instagram_automations_updated_at ON public.instagram_automations;
CREATE TRIGGER instagram_automations_updated_at
  BEFORE UPDATE ON public.instagram_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_instagram_automation_updated_at();
