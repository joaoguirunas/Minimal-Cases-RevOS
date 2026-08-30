-- Fix WAT-02 sync duplicates: edge function used '_' separator instead of '|'
-- This caused duplicate records and original templates marked as 'deleted'.
--
-- Strategy:
--   1. For each template with '_' slug that has a matching '|' slug:
--      - Update the '|' record with the newer data from '_' record
--      - Delete the '_' duplicate
--   2. Restore templates incorrectly marked as 'deleted' by orphan detection
--   3. Fix any remaining '_' slugs to '|' format

BEGIN;

-- Step 1: Remove duplicates created by sync with wrong slug separator
-- Keep the original '|' record, delete the '_' duplicate
DELETE FROM public.whatsapp_templates
WHERE id IN (
  SELECT dup.id
  FROM public.whatsapp_templates dup
  INNER JOIN public.whatsapp_templates orig
    ON orig.id_template = dup.id_template
    AND orig.id != dup.id
  WHERE dup.slug LIKE '%\_%'
    AND dup.slug NOT LIKE '%|%'
    AND orig.slug LIKE '%|%'
);

-- Step 2: Restore templates incorrectly marked as deleted by orphan detection
-- These are templates that exist in Meta (have valid id_template) but were
-- marked deleted because their '|' slug wasn't in the '_' slug set
UPDATE public.whatsapp_templates
SET status = 'approved',
    updated_at = now()
WHERE status = 'deleted'
  AND id_template IS NOT NULL
  AND id_template != ''
  AND slug LIKE '%|%';

-- Step 3: Fix any orphaned '_' slugs (no matching '|' record) to use '|' format
-- Language codes follow pattern: xx_XX (e.g., pt_BR, en_US, es_AR)
-- Replace the '_' before the language code with '|'
UPDATE public.whatsapp_templates
SET slug = regexp_replace(slug, '_([a-z]{2}_[A-Z]{2})$', '|\1')
WHERE slug NOT LIKE '%|%'
  AND slug ~ '_[a-z]{2}_[A-Z]{2}$';

COMMIT;
