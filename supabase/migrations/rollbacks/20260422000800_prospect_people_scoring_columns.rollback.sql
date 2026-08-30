-- ============================================================
-- ROLLBACK: Prospect PRO™ — AI Scoring columns em prospect_people
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_prospect_people_ai_score;

ALTER TABLE public.prospect_people
  DROP COLUMN IF EXISTS ai_score,
  DROP COLUMN IF EXISTS ai_reasoning,
  DROP COLUMN IF EXISTS ai_tags;

COMMIT;
