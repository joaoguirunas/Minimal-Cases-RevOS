-- =============================================================================
-- Migration: P5 — Replace is_admin_or_gestor with is_admin_or_manager in all RLS policies
-- =============================================================================
-- Context:
--   P4 introduced is_admin_or_manager() and kept is_admin_or_gestor() as a
--   thin wrapper so no policies broke. This migration:
--     1. Rebuilds all 58 affected policies (55 in public + 3 in storage.objects)
--        using is_admin_or_manager() directly
--     2. Drops is_admin_or_gestor() — wrapper no longer needed
--
-- Approach:
--   A single DO block reads pg_policies across all schemas, performs a text
--   replacement in the USING/WITH CHECK expressions, then drops + recreates
--   each policy atomically.
-- =============================================================================

BEGIN;

-- ============================================================
-- STEP 1: Rebuild all affected policies across all schemas
-- ============================================================
DO $$
DECLARE
  r         RECORD;
  new_qual  TEXT;
  new_check TEXT;
  stmt      TEXT;
BEGIN
  FOR r IN
    SELECT
      schemaname,
      tablename,
      policyname,
      cmd,
      permissive,
      array_to_string(roles, ', ') AS role_list,
      qual::text       AS qual_txt,
      with_check::text AS check_txt
    FROM pg_policies
    WHERE (   qual::text       ILIKE '%is_admin_or_gestor%'
           OR with_check::text ILIKE '%is_admin_or_gestor%')
    ORDER BY schemaname, tablename, policyname
  LOOP
    -- Replace old function name → new function name
    new_qual  := replace(r.qual_txt,  'is_admin_or_gestor()', 'is_admin_or_manager()');
    new_check := replace(r.check_txt, 'is_admin_or_gestor()', 'is_admin_or_manager()');

    -- Drop the existing policy (use schemaname.tablename)
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);

    -- Rebuild CREATE POLICY
    stmt := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename,
      r.permissive, r.cmd, r.role_list);

    IF new_qual IS NOT NULL THEN
      stmt := stmt || ' USING (' || new_qual || ')';
    END IF;

    IF new_check IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE stmt;

    RAISE NOTICE 'Rebuilt %.%.% (%)', r.schemaname, r.tablename, r.policyname, r.cmd;
  END LOOP;
END;
$$;


-- ============================================================
-- STEP 2: Drop the wrapper function — no longer referenced
-- ============================================================
DROP FUNCTION IF EXISTS public.is_admin_or_gestor();


-- ============================================================
-- STEP 3: Verify — must return 0 rows
-- ============================================================
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_policies
  WHERE (   qual::text       ILIKE '%is_admin_or_gestor%'
         OR with_check::text ILIKE '%is_admin_or_gestor%');

  IF remaining > 0 THEN
    RAISE EXCEPTION 'P5 verification failed: % policies still reference is_admin_or_gestor()', remaining;
  ELSE
    RAISE NOTICE 'P5 verified OK — 0 policies reference is_admin_or_gestor()';
  END IF;
END;
$$;

COMMIT;
