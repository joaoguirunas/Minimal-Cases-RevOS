-- ============================================================
-- OMNI Identity Unification — Contact Dedup & Auto-Merge
-- ============================================================
-- Strategy: NO unique constraints (duplicates are allowed to exist).
-- A DB trigger fires on any identity field change and auto-merges
-- matching records into one canonical person.
-- Merge scope: messages only (NOT leads/negocios as per spec).
-- ============================================================

-- 1. New columns on clients_people
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS instagram_handle    TEXT,
  ADD COLUMN IF NOT EXISTS merged_into_id      UUID REFERENCES public.clients_people(id),
  ADD COLUMN IF NOT EXISTS merge_history       JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 2. Allow 'merged' as a valid status value
-- Drop existing check constraint if it exists, re-add with merged included
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_people_status_check'
  ) THEN
    ALTER TABLE public.clients_people DROP CONSTRAINT clients_people_status_check;
  END IF;
END;
$$;

ALTER TABLE public.clients_people
  ADD CONSTRAINT clients_people_status_check
  CHECK (status IN ('active', 'inactive', 'archived', 'merged'));

-- 3. Performance indexes for identity lookups
CREATE INDEX IF NOT EXISTS idx_people_whatsapp
  ON public.clients_people(whatsapp) WHERE whatsapp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_email
  ON public.clients_people(LOWER(email)) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_document
  ON public.clients_people(document) WHERE document IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_instagram_user_id
  ON public.clients_people(instagram_user_id) WHERE instagram_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_instagram_handle
  ON public.clients_people(LOWER(instagram_handle)) WHERE instagram_handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_merged_into_id
  ON public.clients_people(merged_into_id) WHERE merged_into_id IS NOT NULL;

-- 4. find_duplicate_person: returns the canonical (oldest) record matching any identity key
CREATE OR REPLACE FUNCTION public.find_duplicate_person(
  p_exclude_id         UUID,
  p_whatsapp           TEXT DEFAULT NULL,
  p_email              TEXT DEFAULT NULL,
  p_document           TEXT DEFAULT NULL,
  p_instagram_user_id  TEXT DEFAULT NULL,
  p_instagram_handle   TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.clients_people
  WHERE id <> p_exclude_id
    AND status <> 'merged'
    AND (
      (p_whatsapp          IS NOT NULL AND whatsapp          = p_whatsapp) OR
      (p_email             IS NOT NULL AND LOWER(email)      = LOWER(p_email)) OR
      (p_document          IS NOT NULL AND document          = p_document) OR
      (p_instagram_user_id IS NOT NULL AND instagram_user_id = p_instagram_user_id) OR
      (p_instagram_handle  IS NOT NULL AND LOWER(instagram_handle) = LOWER(p_instagram_handle))
    )
  ORDER BY created_at ASC   -- oldest = canonical
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- 5. merge_persons: re-parents messages, copies identity fields, marks duplicate
-- Scope: messages only (NOT leads/negocios per spec)
CREATE OR REPLACE FUNCTION public.merge_persons(
  p_canonical_id  UUID,
  p_duplicate_id  UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_canonical  public.clients_people%ROWTYPE;
  v_duplicate  public.clients_people%ROWTYPE;
  v_msg_count  INT;
  v_merge_event JSONB;
BEGIN
  SELECT * INTO v_canonical FROM public.clients_people WHERE id = p_canonical_id FOR UPDATE;
  SELECT * INTO v_duplicate FROM public.clients_people WHERE id = p_duplicate_id FOR UPDATE;

  IF v_canonical.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: canonical_id % not found', p_canonical_id;
  END IF;
  IF v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: duplicate_id % not found', p_duplicate_id;
  END IF;
  IF v_duplicate.status = 'merged' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already merged');
  END IF;

  -- Re-parent messages (scope: messages only)
  UPDATE public.messages
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;

  -- Copy non-null identity fields to canonical (never overwrite existing values)
  UPDATE public.clients_people SET
    email              = COALESCE(email,              v_duplicate.email),
    document           = COALESCE(document,           v_duplicate.document),
    whatsapp           = COALESCE(whatsapp,           v_duplicate.whatsapp),
    telefone           = COALESCE(telefone,           v_duplicate.telefone),
    instagram_user_id  = COALESCE(instagram_user_id,  v_duplicate.instagram_user_id),
    instagram_id       = COALESCE(instagram_id,       v_duplicate.instagram_id),
    instagram_handle   = COALESCE(instagram_handle,   v_duplicate.instagram_handle),
    -- If canonical name is a generic placeholder, prefer duplicate's name
    name = CASE
      WHEN name IN ('WhatsApp User', 'Instagram User', '') THEN COALESCE(NULLIF(v_duplicate.name, ''), name)
      ELSE name
    END,
    merge_history = merge_history || jsonb_build_array(
      jsonb_build_object(
        'merged_at',       NOW(),
        'duplicate_id',    p_duplicate_id,
        'duplicate_name',  v_duplicate.name,
        'messages_moved',  v_msg_count
      )
    ),
    updated_at = NOW()
  WHERE id = p_canonical_id;

  -- Mark duplicate as merged (keeps record for audit — never deleted)
  UPDATE public.clients_people SET
    status          = 'merged',
    merged_into_id  = p_canonical_id,
    updated_at      = NOW()
  WHERE id = p_duplicate_id;

  v_merge_event := jsonb_build_object(
    'canonical_id',   p_canonical_id,
    'duplicate_id',   p_duplicate_id,
    'messages_moved', v_msg_count
  );

  RETURN v_merge_event;
END;
$$;

-- 6. Trigger function: auto-merge when any identity field changes
CREATE OR REPLACE FUNCTION public.trg_auto_merge_on_identity()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_dup_id         UUID;
  v_canonical      UUID;
  v_duplicate      UUID;
  v_dup_created_at TIMESTAMPTZ;
BEGIN
  -- Skip if already inside a merge call (prevents recursion)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Skip merged records (no point deduping a duplicate)
  IF NEW.status = 'merged' THEN
    RETURN NEW;
  END IF;

  -- Skip if no identity field has a value worth checking
  IF NEW.whatsapp IS NULL
    AND NEW.email IS NULL
    AND NEW.document IS NULL
    AND NEW.instagram_user_id IS NULL
    AND NEW.instagram_handle IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- Find the oldest other record sharing any identity key
  v_dup_id := public.find_duplicate_person(
    NEW.id,
    NEW.whatsapp,
    NEW.email,
    NEW.document,
    NEW.instagram_user_id,
    NEW.instagram_handle
  );

  IF v_dup_id IS NULL THEN
    RETURN NEW;  -- No duplicate found, nothing to do
  END IF;

  -- Decide canonical vs duplicate by age (older = canonical)
  SELECT created_at INTO v_dup_created_at
  FROM public.clients_people WHERE id = v_dup_id;

  IF v_dup_created_at <= NEW.created_at THEN
    -- Found record is older → it is canonical, NEW is duplicate
    v_canonical := v_dup_id;
    v_duplicate := NEW.id;
  ELSE
    -- NEW is older → NEW is canonical, found record is duplicate
    v_canonical := NEW.id;
    v_duplicate := v_dup_id;
  END IF;

  PERFORM public.merge_persons(v_canonical, v_duplicate);

  RETURN NEW;
END;
$$;

-- 7. Attach trigger
DROP TRIGGER IF EXISTS trg_identity_auto_merge ON public.clients_people;

CREATE TRIGGER trg_identity_auto_merge
  AFTER INSERT OR UPDATE OF email, document, whatsapp, instagram_user_id, instagram_handle
  ON public.clients_people
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_merge_on_identity();

-- 8. RLS: allow reading merge_history and new columns (inherits existing policies)
-- No new policies needed — existing RLS on clients_people covers all columns.

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.find_duplicate_person TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_persons TO authenticated, service_role;
