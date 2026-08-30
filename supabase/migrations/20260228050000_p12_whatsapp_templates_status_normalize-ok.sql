-- P12: whatsapp_templates.status value standardization (Portuguese → English)
--
-- Current values: 'ativo', 'inativo' (internal) + Gupshup API values (often uppercase)
-- The UI uses status.toLowerCase() — confirming uppercase values exist in DB.
-- Canonical values after P12: lowercase only, with internal PT values → English.
--
-- No CHECK constraint existed on this column — just a DEFAULT 'ativo'.

BEGIN;

-- === STEP 1: Lowercase all values first (normalize API-returned uppercase) ===

UPDATE public.whatsapp_templates SET status = LOWER(status)
  WHERE status != LOWER(status);

-- === STEP 2: Normalize internal Portuguese values ===

UPDATE public.whatsapp_templates SET status = 'active'
  WHERE status = 'ativo';

UPDATE public.whatsapp_templates SET status = 'inactive'
  WHERE status = 'inativo';

-- === STEP 2: Update default value on column ===

ALTER TABLE public.whatsapp_templates ALTER COLUMN status SET DEFAULT 'active';

-- === STEP 3: Add CHECK constraint covering all valid values ===
-- Includes Gupshup API values (lowercase) that may be synced directly to this column.

ALTER TABLE public.whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_status_check;

ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_status_check
  CHECK (status = ANY (ARRAY[
    'active'::text,
    'inactive'::text,
    'approved'::text,
    'rejected'::text,
    'pending'::text,
    'submitted'::text,
    'paused'::text,
    'disabled'::text,
    'deleted'::text,
    'in_appeal'::text,
    'flagged'::text
  ]));

-- === STEP 4: Verify ===

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.whatsapp_templates
  WHERE status NOT IN ('active', 'inactive', 'approved', 'rejected', 'pending',
                       'submitted', 'paused', 'disabled', 'deleted', 'in_appeal', 'flagged');

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'P12 verification failed: % templates have non-canonical status', bad_count;
  ELSE
    RAISE NOTICE 'P12 verified OK — all whatsapp_templates.status values are canonical';
  END IF;
END $$;

COMMIT;
