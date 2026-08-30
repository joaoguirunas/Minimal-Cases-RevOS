-- ROLLBACK: FWUP-11 — restaurar nomes PT em followup_queue

BEGIN;

DROP VIEW IF EXISTS public.followup_queue_legacy;

ALTER TABLE public.followup_queue RENAME COLUMN channel      TO canal;
ALTER TABLE public.followup_queue RENAME COLUMN message      TO mensagem;
ALTER TABLE public.followup_queue RENAME COLUMN person_id    TO pessoa_id;
ALTER TABLE public.followup_queue RENAME COLUMN scheduled_for TO scheduled_at;

DROP INDEX IF EXISTS public.idx_followup_queue_status_scheduled_for;

CREATE INDEX IF NOT EXISTS idx_followup_queue_status_scheduled
  ON public.followup_queue (status, scheduled_at)
  WHERE status IN ('pending', 'queued');

RAISE NOTICE 'FWUP-11 ROLLBACK — colunas PT restauradas, VIEW legacy removida.';

COMMIT;
