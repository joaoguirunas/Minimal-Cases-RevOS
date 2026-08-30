-- P9: clients_people.status value standardization (Portuguese → English)
--
-- Current values: 'ativo', 'inativo', 'arquivado'
-- Canonical values: 'active', 'inactive', 'archived'
--
-- NOTE: P8 sed already replaced 'arquivado'→'archived' in src files (useArquivarPessoa,
-- usePessoas) while the DB constraint still enforced 'arquivado'. This migration
-- fixes that live inconsistency by migrating DB data to match the src expectation.

BEGIN;

-- === STEP 1: Drop old constraint first (it rejects the new canonical values) ===

ALTER TABLE public.clients_people DROP CONSTRAINT IF EXISTS clients_people_status_check;

-- === STEP 2: Normalize data ===

UPDATE public.clients_people SET status = 'active'
  WHERE status IN ('ativo', 'active');  -- idempotent: 'active' rows already correct

UPDATE public.clients_people SET status = 'inactive'
  WHERE status = 'inativo';

UPDATE public.clients_people SET status = 'archived'
  WHERE status = 'arquivado';

-- === STEP 3: Update default value on column ===

ALTER TABLE public.clients_people ALTER COLUMN status SET DEFAULT 'active';

-- === STEP 4: Add new CHECK constraint with canonical values ===

ALTER TABLE public.clients_people ADD CONSTRAINT clients_people_status_check
  CHECK (status = ANY (ARRAY[
    'active'::text,
    'inactive'::text,
    'archived'::text
  ]));

-- === STEP 5: Verify ===

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.clients_people
  WHERE status NOT IN ('active', 'inactive', 'archived');

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'P9 verification failed: % people have non-canonical status', bad_count;
  ELSE
    RAISE NOTICE 'P9 verified OK — all clients_people.status values are canonical';
  END IF;
END $$;

COMMIT;
