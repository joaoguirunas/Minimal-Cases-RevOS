-- ============================================================
-- Prospect PRO™ — AI Scoring columns em prospect_people
--
-- Depends on: 20260422000500 (prospect_people_v2 → prospect_people)
-- Adds: ai_score, ai_reasoning, ai_tags + composite index
-- ============================================================

BEGIN;

ALTER TABLE public.prospect_people
  ADD COLUMN IF NOT EXISTS ai_score     integer CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ADD COLUMN IF NOT EXISTS ai_reasoning text,
  ADD COLUMN IF NOT EXISTS ai_tags      text[];

CREATE INDEX IF NOT EXISTS idx_prospect_people_ai_score
  ON public.prospect_people(campaign_id, ai_score DESC) WHERE ai_score IS NOT NULL;

COMMIT;
