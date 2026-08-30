-- ============================================================
-- ROLLBACK: Prospect PRO™ — Rename prospect_people_v2 → prospect_people
-- Restores original table names and index names
-- ============================================================

BEGIN;

-- 1. Rename indexes back to _v2 suffix
ALTER INDEX IF EXISTS idx_pp_company RENAME TO idx_ppv2_company;
ALTER INDEX IF EXISTS idx_pp_campaign_status RENAME TO idx_ppv2_campaign_status;
ALTER INDEX IF EXISTS idx_pp_role RENAME TO idx_ppv2_role;
ALTER INDEX IF EXISTS idx_pp_seniority RENAME TO idx_ppv2_seniority;
ALTER INDEX IF EXISTS idx_pp_selected RENAME TO idx_ppv2_selected;
ALTER INDEX IF EXISTS idx_pp_email RENAME TO idx_ppv2_email;
ALTER INDEX IF EXISTS idx_pp_person_id RENAME TO idx_ppv2_person_id;
ALTER INDEX IF EXISTS idx_pp_explorium_pid RENAME TO idx_ppv2_explorium_pid;

-- 2. Rename RLS policies back
ALTER POLICY "prospect_people_select" ON public.prospect_people RENAME TO "prospect_people_v2_select";
ALTER POLICY "prospect_people_insert" ON public.prospect_people RENAME TO "prospect_people_v2_insert";
ALTER POLICY "prospect_people_update" ON public.prospect_people RENAME TO "prospect_people_v2_update";
ALTER POLICY "prospect_people_delete" ON public.prospect_people RENAME TO "prospect_people_v2_delete";

-- 3. Rename prospect_people (currently v2) back to prospect_people_v2
ALTER TABLE public.prospect_people RENAME TO prospect_people_v2;

-- 4. Rename prospect_people_legacy back to prospect_people (v1)
ALTER TABLE public.prospect_people_legacy RENAME TO prospect_people;

COMMIT;
