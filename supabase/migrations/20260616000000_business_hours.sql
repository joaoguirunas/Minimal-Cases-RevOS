-- ══════════════════════════════════════════════════════════════════════════════
-- Business Hours Feature
--
-- Adds:
--   • settings_business_hours — global config (singleton)
--   • business_hours_only, bh_only_last → meetings_followups
--   • business_hours_only, bh_only_last → leads_stages_followups
--   • held_for_bh, original_scheduled_for → meeting_followup_queue
--   • held_for_bh, original_scheduled_for → followup_queue
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Global settings table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settings_business_hours (
  id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled       BOOLEAN   NOT NULL DEFAULT false,
  start_hour    SMALLINT  NOT NULL DEFAULT 8  CHECK (start_hour BETWEEN 0 AND 23),
  end_hour      SMALLINT  NOT NULL DEFAULT 18 CHECK (end_hour   BETWEEN 1 AND 24),
  days_of_week  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  timezone      TEXT      NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_manage_business_hours"
  ON public.settings_business_hours
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed default row (singleton pattern — only one row ever)
ALTER TABLE public.settings_business_hours
  ADD COLUMN IF NOT EXISTS bh_only_last BOOLEAN NOT NULL DEFAULT true;

INSERT INTO public.settings_business_hours (enabled, start_hour, end_hour, days_of_week, timezone, bh_only_last)
VALUES (false, 8, 18, '{1,2,3,4,5}', 'America/Sao_Paulo', true);

-- ─── 2. meetings_followups — per-rule config ──────────────────────────────────

ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS business_hours_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bh_only_last        BOOLEAN NOT NULL DEFAULT true;

-- ─── 3. leads_stages_followups — per-rule config ─────────────────────────────

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS business_hours_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bh_only_last        BOOLEAN NOT NULL DEFAULT true;

-- ─── 4. meeting_followup_queue — hold tracking ───────────────────────────────

ALTER TABLE public.meeting_followup_queue
  ADD COLUMN IF NOT EXISTS held_for_bh             BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_scheduled_for  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mfq_bh_dedup
  ON public.meeting_followup_queue (meeting_id, original_scheduled_for)
  WHERE held_for_bh = true;

-- ─── 5. followup_queue — hold tracking ───────────────────────────────────────

ALTER TABLE public.followup_queue
  ADD COLUMN IF NOT EXISTS held_for_bh             BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_scheduled_for  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fq_bh_dedup
  ON public.followup_queue (lead_id, original_scheduled_for)
  WHERE held_for_bh = true;

COMMIT;
