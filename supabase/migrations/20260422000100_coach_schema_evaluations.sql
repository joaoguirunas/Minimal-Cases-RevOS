-- CoachPRO™ — Schema: Evaluations, Results, Settings (CF-1.2)
-- Migration: 20260422000100

-- ── 1. meeting_evaluations — resultado de avaliação por reunião ───────────────

CREATE TABLE IF NOT EXISTS public.meeting_evaluations (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id               UUID         NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  playbook_id              UUID         NOT NULL REFERENCES public.playbooks(id) ON DELETE RESTRICT,

  -- Controlo de versão
  evaluation_version       INT          NOT NULL DEFAULT 1,
  superseded_at            TIMESTAMPTZ,

  -- Estado
  status                   TEXT         NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','processing','done','failed')),
  triggered_by             TEXT         NOT NULL DEFAULT 'auto'
                             CHECK (triggered_by IN ('auto','manual')),
  error_message            TEXT,

  -- Auditoria de IA
  model_used               TEXT,
  provider_used            TEXT,
  prompt_version           TEXT,

  -- Métricas globais
  overall_score            NUMERIC(4,2),
  overall_verdict          TEXT CHECK (overall_verdict IN ('excellent','good','needs_improvement','critical')),

  -- Métricas de comunicação (calculadas localmente)
  talk_ratio_consultant    NUMERIC(4,1),
  talk_ratio_client        NUMERIC(4,1),
  questions_total          INT,
  questions_open           INT,
  monologue_longest_sec    INT,
  competitors_mentioned    TEXT[],

  -- Deal intelligence
  deal_risk                TEXT CHECK (deal_risk IN ('low','medium','high')),
  sentiment_arc            JSONB,

  -- Narrativa gerada por LLM
  strengths                TEXT[],
  gaps                     TEXT[],
  next_steps               TEXT[],
  coaching_script          TEXT,
  follow_up_agenda         TEXT,

  -- Controlo
  evaluated_at             TIMESTAMPTZ,
  email_sent_at            TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_evaluations_all" ON public.meeting_evaluations;
CREATE POLICY "meeting_evaluations_all"
  ON public.meeting_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_meeting_evaluations_meeting_id
  ON public.meeting_evaluations(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_evaluations_created_at_desc
  ON public.meeting_evaluations(created_at DESC);

-- Fila de processamento: só filtra linhas pendentes/em curso
CREATE INDEX IF NOT EXISTS idx_meeting_evaluations_status
  ON public.meeting_evaluations(status)
  WHERE status IN ('pending','processing');

-- Versão activa por meeting+playbook (sem superseded_at = versão mais recente)
CREATE INDEX IF NOT EXISTS idx_meeting_evaluations_active_version
  ON public.meeting_evaluations(meeting_id, playbook_id)
  WHERE superseded_at IS NULL;

-- ── 2. evaluation_section_results — resultado por secção ─────────────────────

CREATE TABLE IF NOT EXISTS public.evaluation_section_results (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID         NOT NULL REFERENCES public.meeting_evaluations(id) ON DELETE CASCADE,
  section_id    UUID         NOT NULL REFERENCES public.playbook_sections(id) ON DELETE RESTRICT,
  score         NUMERIC(4,2),
  summary       TEXT,
  UNIQUE(evaluation_id, section_id)
);

ALTER TABLE public.evaluation_section_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evaluation_section_results_all" ON public.evaluation_section_results;
CREATE POLICY "evaluation_section_results_all"
  ON public.evaluation_section_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_eval_section_results_evaluation_id
  ON public.evaluation_section_results(evaluation_id);

-- ── 3. evaluation_criteria_results — resultado por critério ──────────────────

CREATE TABLE IF NOT EXISTS public.evaluation_criteria_results (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id    UUID         NOT NULL REFERENCES public.meeting_evaluations(id) ON DELETE CASCADE,
  criterion_id     UUID         NOT NULL REFERENCES public.playbook_criteria(id) ON DELETE RESTRICT,
  verdict          TEXT         NOT NULL CHECK (verdict IN ('met','partial','not_met')),
  confidence       NUMERIC(4,1),
  score            NUMERIC(4,2),
  quote            TEXT,
  quote_start_sec  INT,
  coaching_tip     TEXT,
  UNIQUE(evaluation_id, criterion_id)
);

ALTER TABLE public.evaluation_criteria_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evaluation_criteria_results_all" ON public.evaluation_criteria_results;
CREATE POLICY "evaluation_criteria_results_all"
  ON public.evaluation_criteria_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_eval_criteria_results_evaluation_id
  ON public.evaluation_criteria_results(evaluation_id);

-- ── 4. coach_email_log — log de emails enviados ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.coach_email_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id    UUID        NOT NULL REFERENCES public.meeting_evaluations(id) ON DELETE CASCADE,
  recipient_email  TEXT        NOT NULL,
  recipient_type   TEXT        NOT NULL CHECK (recipient_type IN ('consultant','manager')),
  subject          TEXT,
  sent_at          TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','sent','failed')),
  error            TEXT
);

ALTER TABLE public.coach_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_email_log_all" ON public.coach_email_log;
CREATE POLICY "coach_email_log_all"
  ON public.coach_email_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_coach_email_log_evaluation_id
  ON public.coach_email_log(evaluation_id);

-- ── 5. coach_ai_settings — configurações do módulo Coach ─────────────────────

CREATE TABLE IF NOT EXISTS public.coach_ai_settings (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_context          TEXT,
  email_auto_send           BOOL         NOT NULL DEFAULT true,
  email_consultant          BOOL         NOT NULL DEFAULT true,
  email_manager             BOOL         NOT NULL DEFAULT true,
  email_manager_threshold   NUMERIC(3,1),
  manager_user_id           UUID         REFERENCES public.settings_users(id) ON DELETE SET NULL,
  weekly_summary_enabled    BOOL         NOT NULL DEFAULT false,
  weekly_summary_day        INT          DEFAULT 0 CHECK (weekly_summary_day BETWEEN 0 AND 6),
  weekly_summary_hour       INT          DEFAULT 8 CHECK (weekly_summary_hour BETWEEN 0 AND 23),
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_ai_settings_all" ON public.coach_ai_settings;
CREATE POLICY "coach_ai_settings_all"
  ON public.coach_ai_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Singleton: seed de linha inicial vazia para garantir que a tabela tem sempre 1 registo
INSERT INTO public.coach_ai_settings DEFAULT VALUES
ON CONFLICT DO NOTHING;
