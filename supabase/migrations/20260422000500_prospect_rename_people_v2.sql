-- ============================================================
-- Prospect PRO™ — Rename prospect_people_v2 → prospect_people
--
-- Precondition: prospect_people (v1, linked to prospect_establishments) must
-- still exist at this point — it is renamed to prospect_people_legacy first,
-- freeing the name. Then prospect_people_v2 is renamed to prospect_people.
--
-- Edge functions that reference prospect_people (v1 path):
--   - prospect-scorer: reads prospect_people by establishment_id
--   - prospect-commit (v1 branch): reads/writes prospect_people
-- These functions must be updated AFTER this migration is applied.
-- Until updated, v1 campaigns (version=1) will fail to score and commit.
-- v2/v3 campaigns are unaffected.
--
-- Indexes are renamed to match the new table name for clarity.
-- The FK in prospect_enrichment_results is automatically updated by Postgres
-- when the referenced table is renamed (FK tracks by OID, not name).
-- ============================================================

BEGIN;

DO $$
BEGIN
  -- 1. Rename v1 prospect_people → prospect_people_legacy (only if v2 still exists and legacy doesn't)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='prospect_people_v2')
    AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='prospect_people_legacy')
  THEN
    ALTER TABLE public.prospect_people RENAME TO prospect_people_legacy;
  END IF;

  -- 2. Rename prospect_people_v2 → prospect_people (only if v2 still exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='prospect_people_v2') THEN
    ALTER TABLE public.prospect_people_v2 RENAME TO prospect_people;

    -- 3. Rename RLS policies on the newly renamed table (ignore errors if already renamed)
    BEGIN
      ALTER POLICY "prospect_people_v2_select" ON public.prospect_people RENAME TO "prospect_people_select";
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      ALTER POLICY "prospect_people_v2_insert" ON public.prospect_people RENAME TO "prospect_people_insert";
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      ALTER POLICY "prospect_people_v2_update" ON public.prospect_people RENAME TO "prospect_people_update";
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      ALTER POLICY "prospect_people_v2_delete" ON public.prospect_people RENAME TO "prospect_people_delete";
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END IF;
END;
$$;

-- 4. Rename indexes to drop the _v2 suffix (IF EXISTS handles idempotency)
ALTER INDEX IF EXISTS idx_ppv2_company RENAME TO idx_pp_company;
ALTER INDEX IF EXISTS idx_ppv2_campaign_status RENAME TO idx_pp_campaign_status;
ALTER INDEX IF EXISTS idx_ppv2_role RENAME TO idx_pp_role;
ALTER INDEX IF EXISTS idx_ppv2_seniority RENAME TO idx_pp_seniority;
ALTER INDEX IF EXISTS idx_ppv2_selected RENAME TO idx_pp_selected;
ALTER INDEX IF EXISTS idx_ppv2_email RENAME TO idx_pp_email;
ALTER INDEX IF EXISTS idx_ppv2_person_id RENAME TO idx_pp_person_id;
ALTER INDEX IF EXISTS idx_ppv2_explorium_pid RENAME TO idx_pp_explorium_pid;

-- 5. The FK in prospect_enrichment_results references prospect_people_v2 by OID.
--    Postgres automatically tracks the renamed table — no ALTER needed.
--    The constraint name remains valid as-is.

COMMIT;
