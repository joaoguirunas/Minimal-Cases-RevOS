-- FWUP-11: Padronizar nomenclatura PT→EN em followup_queue
--
-- Colunas renomeadas:
--   canal        → channel
--   mensagem     → message
--   pessoa_id    → person_id  (alinhar com meeting_followup_queue e clients_people PK pattern)
--   scheduled_at → scheduled_for (alinhar com meeting_followup_queue)
--
-- VIEW followup_queue_legacy criada para grace period de 30 dias.
-- Drop da VIEW após 30 dias: migration 20260527080000_fwup11_drop_legacy_view.sql

BEGIN;

-- ─── 1. Renomear colunas (idempotente: skip se já renomeada) ─────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='followup_queue' AND column_name='canal') THEN
    ALTER TABLE public.followup_queue RENAME COLUMN canal TO channel;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='followup_queue' AND column_name='mensagem') THEN
    ALTER TABLE public.followup_queue RENAME COLUMN mensagem TO message;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='followup_queue' AND column_name='pessoa_id') THEN
    ALTER TABLE public.followup_queue RENAME COLUMN pessoa_id TO person_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='followup_queue' AND column_name='scheduled_at') THEN
    ALTER TABLE public.followup_queue RENAME COLUMN scheduled_at TO scheduled_for;
  END IF;
END $$;

-- ─── 2. Atualizar índice que referencia scheduled_at ─────────────────────────

DROP INDEX IF EXISTS public.idx_followup_queue_status_scheduled;

CREATE INDEX IF NOT EXISTS idx_followup_queue_status_scheduled_for
  ON public.followup_queue (status, scheduled_for)
  WHERE status IN ('pending', 'queued');

-- ─── 3. VIEW de compatibilidade (grace period 30 dias) ───────────────────────

CREATE OR REPLACE VIEW public.followup_queue_legacy AS
SELECT
  id,
  followup_id,
  meeting_followup_id,
  lead_id,
  person_id          AS pessoa_id,
  channel            AS canal,
  template_id,
  message            AS mensagem,
  assunto,
  phone_number,
  source_type,
  scheduled_for      AS scheduled_at,
  fired_at,
  status,
  message_id,
  response_data,
  error_message,
  retry_count,
  created_at,
  updated_at
FROM public.followup_queue;

COMMENT ON VIEW public.followup_queue_legacy IS
  'Grace period view com colunas PT (canal, mensagem, pessoa_id, scheduled_at). '
  'Dropar após 2026-05-27 via migration 20260527080000_fwup11_drop_legacy_view.sql.';

-- ─── 4. Atualizar índice de retry worker (referencia colunas) ────────────────

DROP INDEX IF EXISTS public.idx_fup_queue_retry;

CREATE INDEX IF NOT EXISTS idx_fup_queue_retry
  ON public.followup_queue (status, updated_at, retry_count)
  WHERE status = 'queued';

-- ─── 5. Smoke test ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'followup_queue' AND column_name = 'channel'
  ) THEN
    RAISE EXCEPTION 'FWUP-11 SMOKE FAIL: coluna channel não existe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'followup_queue' AND column_name = 'scheduled_for'
  ) THEN
    RAISE EXCEPTION 'FWUP-11 SMOKE FAIL: coluna scheduled_for não existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'followup_queue' AND column_name IN ('canal', 'mensagem', 'pessoa_id', 'scheduled_at')
  ) THEN
    RAISE EXCEPTION 'FWUP-11 SMOKE FAIL: colunas PT antigas ainda existem em followup_queue';
  END IF;

  RAISE NOTICE 'FWUP-11 SMOKE PASS — colunas renomeadas, VIEW legacy criada.';
END $$;

COMMIT;
