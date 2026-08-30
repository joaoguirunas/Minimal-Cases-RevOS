-- P7: meetings.status normalization
--
-- Problem: meetings.status has accumulated multiple inconsistent forms over time:
--   'agendada'  (old feminine form, still used by Google sync + some UI code)
--   'agendado'  (current standard)
--   'cancelada' (old feminine form)
--   'cancelado' (current standard)
--   'realizada' (old form for "attended")
--   'compareceu'(current standard for "attended")
--   'remarcada' (old form for rescheduled meetings → treated as agendado)
--
-- Impact: Google-synced meetings insert 'agendada' but app queries 'agendado',
--         so Google Calendar meetings NEVER matched in BI, dashboards, or followups.
--
-- Solution: Normalize all old forms to canonical values, update CHECK constraint.

BEGIN;

-- === STEP 1: Normalize existing data ===

UPDATE public.meetings SET status = 'agendado'
  WHERE status IN ('agendada', 'remarcada');

UPDATE public.meetings SET status = 'compareceu'
  WHERE status = 'realizada';

UPDATE public.meetings SET status = 'cancelado'
  WHERE status = 'cancelada';

-- === STEP 2: Tighten CHECK constraint to canonical values only ===

ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE public.meetings ADD CONSTRAINT meetings_status_check
  CHECK (status = ANY (ARRAY[
    'agendado'::text,
    'compareceu'::text,
    'não compareceu'::text,
    'cancelado'::text,
    'bloqueio manual'::text
  ]));

-- === STEP 3: Verify ===

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.meetings
  WHERE status NOT IN ('agendado', 'compareceu', 'não compareceu', 'cancelado', 'bloqueio manual');

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'P7 verification failed: % meetings have non-canonical status', bad_count;
  ELSE
    RAISE NOTICE 'P7 verified OK — all meetings.status values are canonical';
  END IF;
END $$;

COMMIT;
