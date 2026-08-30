-- Fix leads.status: normalize 'ativo' → 'in_progress' and ensure default is correct.
-- Complement to p8_leads_status_normalize (20260228) which didn't cover 'ativo'.
-- Safe to run multiple times (idempotent).

BEGIN;

-- Drop constraint first so we can add/normalize values freely
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Normalize remaining non-canonical values
UPDATE public.leads SET status = 'in_progress'
  WHERE status IN ('em-andamento', 'em_andamento', 'aberto', 'ativo');

UPDATE public.leads SET status = 'won'   WHERE status = 'ganho';
UPDATE public.leads SET status = 'lost'  WHERE status = 'perdido';
UPDATE public.leads SET status = 'archived' WHERE status = 'arquivado';

-- Ensure default is canonical
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'in_progress';

-- Re-add CHECK constraint with canonical values
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY[
    'in_progress'::text,
    'won'::text,
    'lost'::text,
    'archived'::text
  ]));

COMMIT;
