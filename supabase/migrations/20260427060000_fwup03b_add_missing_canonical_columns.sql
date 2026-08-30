-- FWUP-03b: Adicionar colunas canônicas ausentes em leads_stages_followups
--
-- Diagnóstico pós-apply de FWUP-03:
-- O schema em produção foi criado pelo Migration B (20251110) ou C (20251202) que
-- definiu: stage_id, name, message, delay_minutes, whatsapp_template_id, score_matrix_id, active.
-- O Migration A (20251005) rodou depois e foi silenciado pelo CREATE TABLE IF NOT EXISTS.
-- Resultado: colunas canônicas ausentes: type, subject, template_id, audio_file, days, hours, minutes.
-- FWUP-03 dropou stage_id/name/delay_minutes mas não sabia que type/subject/etc também faltavam.
--
-- Esta migration completa a canonicalização adicionando as colunas ausentes.
-- useFollowups.ts usa SELECT *, ordena por days/hours, e escreve type/subject/template_id/etc.

BEGIN;

-- ─── 1. Adicionar colunas canônicas ausentes (idempotente) ───────────────────

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS type       text NOT NULL DEFAULT 'texto';

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS subject    text;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS template_id text;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS audio_file text;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS days       integer NOT NULL DEFAULT 0;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS hours      integer NOT NULL DEFAULT 0;

ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS minutes    integer NOT NULL DEFAULT 0;

-- ─── 2. Backfill delay_minutes → days/hours/minutes (se delay_minutes ainda existir) ──
--
-- delay_minutes pode ter sido dropado pelo FWUP-03. Se existir ainda (rollback scenario),
-- backfillar os valores para o novo campo minutes (aproximação — delay_minutes era em minutos).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'leads_stages_followups'
      AND column_name  = 'delay_minutes'
  ) THEN
    UPDATE public.leads_stages_followups
    SET minutes = delay_minutes,
        days    = 0,
        hours   = 0
    WHERE days = 0 AND hours = 0 AND minutes = 0
      AND delay_minutes IS NOT NULL AND delay_minutes > 0;

    RAISE NOTICE 'FWUP-03b: backfill de delay_minutes → minutes concluído';
  ELSE
    RAISE NOTICE 'FWUP-03b: delay_minutes não existe — sem backfill necessário';
  END IF;
END $$;

-- ─── 3. Remover coluna whatsapp_template_id (TEXT) se for o legado de schema B/C ──
--
-- Schema B/C criou whatsapp_template_id como TEXT (slug/id externo).
-- Se migration 20260427050000_fwup05 já converteu para UUID FK — não dropar.
-- Se ainda é TEXT — dropar pois template_id (text) cobre o mesmo caso de uso.
--
-- Verificação: se o tipo atual é 'text' e não 'uuid', é o legado.

DO $$
DECLARE
  v_col_type text;
BEGIN
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'leads_stages_followups'
    AND column_name  = 'whatsapp_template_id';

  IF v_col_type = 'text' THEN
    -- Legado schema B/C: mesmo papel que template_id, mas nome diferente
    -- Manter por ora — não dropar até confirmar que nenhum dado existe nesta coluna
    -- que não esteja também em template_id. Registrar para revisão manual.
    RAISE NOTICE 'FWUP-03b: whatsapp_template_id é TEXT (schema B/C legado). Mantido — revisar se dados precisam ser copiados para template_id antes de DROP.';
  ELSIF v_col_type = 'uuid' THEN
    RAISE NOTICE 'FWUP-03b: whatsapp_template_id é UUID FK (pós-FWUP-05). Mantido — coluna legítima.';
  ELSE
    RAISE NOTICE 'FWUP-03b: whatsapp_template_id não encontrada.';
  END IF;
END $$;

-- ─── 4. Smoke test ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_missing text[] := '{}';
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['type','subject','template_id','audio_file','days','hours','minutes','leads_stages_id','score_matrix_id','target_stage_id','control']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'leads_stages_followups'
        AND column_name  = col
    ) THEN
      v_missing := array_append(v_missing, col);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'FWUP-03b SMOKE FAIL: colunas canônicas ausentes: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'FWUP-03b SMOKE PASS — todas as colunas canônicas presentes. Schema completo.';
END $$;

COMMIT;
