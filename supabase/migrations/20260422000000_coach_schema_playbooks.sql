-- CoachPRO™ — Schema: Playbooks (CF-1.1)
-- Migration: 20260422000000

-- ── 1. playbook_templates — templates de sistema (só leitura) ─────────────────

CREATE TABLE IF NOT EXISTS public.playbook_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('sales','consulting','mentoring','cs','custom')),
  description   TEXT,
  icon          TEXT,
  color         TEXT,
  is_system     BOOL        NOT NULL DEFAULT true,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.playbook_templates ENABLE ROW LEVEL SECURITY;

-- Templates de sistema: leitura pública para autenticados, sem escrita por tenants
DROP POLICY IF EXISTS "playbook_templates_select" ON public.playbook_templates;
CREATE POLICY "playbook_templates_select"
  ON public.playbook_templates FOR SELECT TO authenticated USING (true);

-- ── 2. playbooks — playbooks por instância (editáveis) ───────────────────────

CREATE TABLE IF NOT EXISTS public.playbooks (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT        NOT NULL,
  type                 TEXT        NOT NULL CHECK (type IN ('sales','consulting','mentoring','cs','custom')),
  description          TEXT,
  parent_template_id   UUID        REFERENCES public.playbook_templates(id) ON DELETE SET NULL,
  is_active            BOOL        NOT NULL DEFAULT true,
  is_default_for_type  BOOL        NOT NULL DEFAULT false,
  created_by           UUID        REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playbooks_all" ON public.playbooks;
CREATE POLICY "playbooks_all"
  ON public.playbooks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_playbooks_type_active
  ON public.playbooks(type) WHERE is_active = true;

-- ── 3. playbook_sections — secções de um playbook ────────────────────────────

CREATE TABLE IF NOT EXISTS public.playbook_sections (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id   UUID         NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  title         TEXT         NOT NULL,
  description   TEXT,
  weight        NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  display_order INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.playbook_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playbook_sections_all" ON public.playbook_sections;
CREATE POLICY "playbook_sections_all"
  ON public.playbook_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_playbook_sections_playbook_id
  ON public.playbook_sections(playbook_id);

-- ── 4. playbook_criteria — critérios individuais ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.playbook_criteria (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id       UUID         NOT NULL REFERENCES public.playbook_sections(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  description      TEXT,
  weight           NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  detection_hints  TEXT[],
  example_good     TEXT,
  example_bad      TEXT,
  is_required      BOOL         NOT NULL DEFAULT false,
  display_order    INT          NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.playbook_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playbook_criteria_all" ON public.playbook_criteria;
CREATE POLICY "playbook_criteria_all"
  ON public.playbook_criteria FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_playbook_criteria_section_id
  ON public.playbook_criteria(section_id);

-- ── 5. meeting_playbook_assignments — associação meeting → playbook ───────────

CREATE TABLE IF NOT EXISTS public.meeting_playbook_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  playbook_id UUID        NOT NULL REFERENCES public.playbooks(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID        REFERENCES public.settings_users(id) ON DELETE SET NULL,
  UNIQUE(meeting_id)
);

ALTER TABLE public.meeting_playbook_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_playbook_assignments_all" ON public.meeting_playbook_assignments;
CREATE POLICY "meeting_playbook_assignments_all"
  ON public.meeting_playbook_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_meeting_playbook_meeting_id
  ON public.meeting_playbook_assignments(meeting_id);

-- ── 6. meeting_type em meetings ───────────────────────────────────────────────

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_type TEXT
    CHECK (meeting_type IN ('discovery','demo','closing','consulting','mentoring','qbr','followup','other'))
    DEFAULT 'discovery';

UPDATE public.meetings SET meeting_type = 'discovery' WHERE meeting_type IS NULL;
