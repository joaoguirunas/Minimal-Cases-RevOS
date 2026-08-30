-- P8: leads.status value standardization (Portuguese → English)
--
-- Current values: 'em-andamento', 'ganho', 'perdido', 'arquivado'
-- Canonical values: 'in_progress', 'won', 'lost', 'archived'
--
-- Also fixes: 'em_andamento' (underscore variant used as fallback in some UI code)
--             'aberto' (older variant for in_progress, may exist in legacy data)

BEGIN;

-- === STEP 1: Drop old constraint first (it rejects the new canonical values) ===

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- === STEP 2: Normalize data ===

UPDATE public.leads SET status = 'in_progress'
  WHERE status IN ('em-andamento', 'em_andamento', 'aberto');

UPDATE public.leads SET status = 'won'
  WHERE status = 'ganho';

UPDATE public.leads SET status = 'lost'
  WHERE status = 'perdido';

UPDATE public.leads SET status = 'archived'
  WHERE status = 'arquivado';

-- === STEP 3: Update default value on column ===

ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'in_progress';

-- === STEP 4: Add new CHECK constraint with canonical values ===

ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY[
    'in_progress'::text,
    'won'::text,
    'lost'::text,
    'archived'::text
  ]));

-- === STEP 4: Verify ===

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.leads
  WHERE status NOT IN ('in_progress', 'won', 'lost', 'archived');

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'P8 verification failed: % leads have non-canonical status', bad_count;
  ELSE
    RAISE NOTICE 'P8 verified OK — all leads.status values are canonical';
  END IF;
END $$;

COMMIT;
