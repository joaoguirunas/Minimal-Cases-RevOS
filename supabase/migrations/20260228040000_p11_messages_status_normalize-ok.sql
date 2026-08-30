-- P11: messages.status value standardization (Portuguese → English)
--
-- Current values (CHECK constraint): 'pendente', 'enviada', 'entregue', 'lida', 'erro'
-- Canonical values:                   'pending',  'sent',    'delivered', 'read', 'error'
--
-- Constraint name: messages_status_check (named in migration 20251203012023)

BEGIN;

-- === STEP 1: Drop old constraint first (rejects new canonical values) ===

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;

-- === STEP 2: Normalize data ===

UPDATE public.messages SET status = 'pending'
  WHERE status = 'pendente';

UPDATE public.messages SET status = 'sent'
  WHERE status = 'enviada';

UPDATE public.messages SET status = 'delivered'
  WHERE status = 'entregue';

UPDATE public.messages SET status = 'read'
  WHERE status = 'lida';

UPDATE public.messages SET status = 'error'
  WHERE status = 'erro';

-- === STEP 3: Update default value on column ===

ALTER TABLE public.messages ALTER COLUMN status SET DEFAULT 'sent';

-- === STEP 4: Add new CHECK constraint with canonical values ===

ALTER TABLE public.messages ADD CONSTRAINT messages_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'sent'::text,
    'delivered'::text,
    'read'::text,
    'error'::text
  ]));

-- === STEP 5: Verify ===

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.messages
  WHERE status NOT IN ('pending', 'sent', 'delivered', 'read', 'error');

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'P11 verification failed: % messages have non-canonical status', bad_count;
  ELSE
    RAISE NOTICE 'P11 verified OK — all messages.status values are canonical';
  END IF;
END $$;

COMMIT;
