-- P10: clients_people.service_status value standardization (Portuguese → English)
--
-- Current values: 'aberto', 'encerrado', 'fechado', 'em-atendimento'
-- Canonical values: 'open', 'closed', 'in_service'
--
-- 'encerrado' and 'fechado' are both "closed" states — merged into 'closed'.
-- No CHECK constraint currently exists on service_status (safe to just UPDATE + ADD).

BEGIN;

-- === STEP 1: Normalize data ===

UPDATE public.clients_people SET service_status = 'open'
  WHERE service_status IN ('aberto', 'open');  -- idempotent

UPDATE public.clients_people SET service_status = 'closed'
  WHERE service_status IN ('encerrado', 'fechado', 'closed');  -- idempotent

UPDATE public.clients_people SET service_status = 'in_service'
  WHERE service_status = 'em-atendimento';

-- === STEP 2: Update default value on column ===

ALTER TABLE public.clients_people ALTER COLUMN service_status SET DEFAULT 'open';

-- === STEP 3: Add CHECK constraint with canonical values ===

ALTER TABLE public.clients_people DROP CONSTRAINT IF EXISTS clients_people_service_status_check;

ALTER TABLE public.clients_people ADD CONSTRAINT clients_people_service_status_check
  CHECK (service_status = ANY (ARRAY[
    'open'::text,
    'closed'::text,
    'in_service'::text
  ]) OR service_status IS NULL);

-- === STEP 4: Verify ===

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.clients_people
  WHERE service_status IS NOT NULL
    AND service_status NOT IN ('open', 'closed', 'in_service');

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'P10 verification failed: % people have non-canonical service_status', bad_count;
  ELSE
    RAISE NOTICE 'P10 verified OK — all clients_people.service_status values are canonical';
  END IF;
END $$;

COMMIT;
