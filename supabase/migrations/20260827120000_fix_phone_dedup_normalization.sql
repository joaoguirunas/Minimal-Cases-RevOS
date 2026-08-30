-- Fix: find_duplicate_person() compared clients_people.whatsapp by exact string
-- equality, so "+5562991169181" and "5562991169181" were treated as different
-- people. This let the existing auto-merge trigger (trg_identity_auto_merge)
-- silently miss duplicates whenever a phone number was stored in a different
-- format than a prior record for the same person, causing split conversation
-- history (inbound replies landing on a shadow contact instead of the real
-- lead/negócio the closer sees in the Kanban).
--
-- Fix: normalize phone numbers before comparing AND before storing, so the
-- column itself stays canonical (plain digits) regardless of which code path
-- writes to it (frontend forms, lp-submit, whatsapp-inbound, manual entry).

BEGIN;

-- 1. SQL port of the existing whatsapp-inbound normalizeBRPhone() JS helper.
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_phone IS NULL THEN NULL
    WHEN length(regexp_replace(p_phone, '\D', '', 'g')) = 12 THEN
      substring(regexp_replace(p_phone, '\D', '', 'g') from 1 for 4)
      || '9'
      || substring(regexp_replace(p_phone, '\D', '', 'g') from 5)
    ELSE regexp_replace(p_phone, '\D', '', 'g')
  END;
$$;

-- 2. find_duplicate_person: compare normalized phone, not raw string.
CREATE OR REPLACE FUNCTION public.find_duplicate_person(
  p_exclude_id uuid,
  p_whatsapp text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_document text DEFAULT NULL::text,
  p_instagram_user_id text DEFAULT NULL::text,
  p_instagram_handle text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.clients_people
  WHERE id <> p_exclude_id
    AND status <> 'merged'
    AND (
      (p_whatsapp          IS NOT NULL AND public.normalize_br_phone(whatsapp) = public.normalize_br_phone(p_whatsapp)) OR
      (p_email             IS NOT NULL AND LOWER(email)      = LOWER(p_email)) OR
      (p_document          IS NOT NULL AND document          = p_document) OR
      (p_instagram_user_id IS NOT NULL AND instagram_user_id = p_instagram_user_id) OR
      (p_instagram_handle  IS NOT NULL AND LOWER(instagram_handle) = LOWER(p_instagram_handle))
    )
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_id;
END;
$function$;

-- 3. Normalize on write — keeps the column canonical no matter which code
--    path inserts/updates it, closing the gap at the source instead of only
--    at comparison time.
CREATE OR REPLACE FUNCTION public.trg_normalize_whatsapp_on_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := public.normalize_br_phone(NEW.whatsapp);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_whatsapp ON public.clients_people;
CREATE TRIGGER trg_normalize_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp ON public.clients_people
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_normalize_whatsapp_on_write();

-- 4. Backfill: normalize existing rows so old data matches the new invariant.
--    Safe — no unique constraint on whatsapp, and every pre-existing exact
--    collision this produces was already reviewed and merged (see step 5)
--    except one pair deliberately left alone (different names on the same
--    number — needs a human to confirm before merging).
UPDATE public.clients_people
SET whatsapp = public.normalize_br_phone(whatsapp)
WHERE whatsapp IS NOT NULL
  AND whatsapp <> public.normalize_br_phone(whatsapp);

COMMIT;
