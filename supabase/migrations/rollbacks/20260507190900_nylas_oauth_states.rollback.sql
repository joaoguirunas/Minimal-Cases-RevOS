-- ═══════════════════════════════════════════════════════════════════
-- 20260507190900_nylas_oauth_states.rollback.sql
-- Rollback NYLAS-03 AC3: remove tabela nylas_oauth_states.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DROP TABLE IF EXISTS public.nylas_oauth_states;

COMMIT;
