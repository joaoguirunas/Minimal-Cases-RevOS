-- ============================================================
-- Prospect PRO™ — Tenant Isolation ROLLBACK
-- Reverts tenant-scoped RLS → permissive + drops NOT NULL + drops indexes
-- NOTE: Does NOT drop the tenant_id column — data is preserved.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Drop tenant-scoped RLS policies
-- ============================================================

DROP POLICY IF EXISTS "prospect_campaigns_select" ON public.prospect_campaigns;
DROP POLICY IF EXISTS "prospect_campaigns_insert" ON public.prospect_campaigns;
DROP POLICY IF EXISTS "prospect_campaigns_update" ON public.prospect_campaigns;
DROP POLICY IF EXISTS "prospect_campaigns_delete" ON public.prospect_campaigns;

DROP POLICY IF EXISTS "prospect_companies_select" ON public.prospect_companies;
DROP POLICY IF EXISTS "prospect_companies_insert" ON public.prospect_companies;
DROP POLICY IF EXISTS "prospect_companies_update" ON public.prospect_companies;
DROP POLICY IF EXISTS "prospect_companies_delete" ON public.prospect_companies;

DROP POLICY IF EXISTS "prospect_people_select" ON public.prospect_people;
DROP POLICY IF EXISTS "prospect_people_insert" ON public.prospect_people;
DROP POLICY IF EXISTS "prospect_people_update" ON public.prospect_people;
DROP POLICY IF EXISTS "prospect_people_delete" ON public.prospect_people;

DROP POLICY IF EXISTS "prospect_enrichment_results_select" ON public.prospect_enrichment_results;
DROP POLICY IF EXISTS "prospect_enrichment_results_insert" ON public.prospect_enrichment_results;
DROP POLICY IF EXISTS "prospect_enrichment_results_update" ON public.prospect_enrichment_results;

DROP POLICY IF EXISTS "prospect_audit_select" ON public.prospect_audit_log;
DROP POLICY IF EXISTS "prospect_audit_insert" ON public.prospect_audit_log;

DROP POLICY IF EXISTS "prospect_opt_out_select" ON public.prospect_opt_out_registry;
DROP POLICY IF EXISTS "prospect_opt_out_insert" ON public.prospect_opt_out_registry;

-- ============================================================
-- 2. Restore permissive RLS policies (original state)
-- ============================================================

CREATE POLICY "prospect_campaigns_select"
  ON public.prospect_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospect_campaigns_insert"
  ON public.prospect_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prospect_campaigns_update"
  ON public.prospect_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prospect_campaigns_delete"
  ON public.prospect_campaigns FOR DELETE TO authenticated USING (true);

CREATE POLICY "prospect_companies_select"
  ON public.prospect_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospect_companies_insert"
  ON public.prospect_companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prospect_companies_update"
  ON public.prospect_companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "prospect_companies_delete"
  ON public.prospect_companies FOR DELETE TO authenticated USING (true);

CREATE POLICY "prospect_people_select"
  ON public.prospect_people FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospect_people_insert"
  ON public.prospect_people FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prospect_people_update"
  ON public.prospect_people FOR UPDATE TO authenticated USING (true);
CREATE POLICY "prospect_people_delete"
  ON public.prospect_people FOR DELETE TO authenticated USING (true);

CREATE POLICY "prospect_enrichment_results_select"
  ON public.prospect_enrichment_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospect_enrichment_results_insert"
  ON public.prospect_enrichment_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prospect_enrichment_results_update"
  ON public.prospect_enrichment_results FOR UPDATE TO authenticated USING (true);

CREATE POLICY "prospect_audit_select"
  ON public.prospect_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospect_audit_insert"
  ON public.prospect_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "prospect_opt_out_select"
  ON public.prospect_opt_out_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospect_opt_out_insert"
  ON public.prospect_opt_out_registry FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 3. Drop NOT NULL constraints (restore nullable tenant_id)
-- ============================================================

ALTER TABLE public.prospect_campaigns ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.prospect_companies ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.prospect_people ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.prospect_enrichment_results ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.prospect_audit_log ALTER COLUMN tenant_id DROP NOT NULL;

-- ============================================================
-- 4. Drop tenant isolation indexes
-- ============================================================

DROP INDEX IF EXISTS public.idx_prospect_campaigns_tenant;
DROP INDEX IF EXISTS public.idx_prospect_campaigns_tenant_status;
DROP INDEX IF EXISTS public.idx_prospect_companies_tenant;
DROP INDEX IF EXISTS public.idx_prospect_companies_tenant_status;
DROP INDEX IF EXISTS public.idx_prospect_people_tenant;
DROP INDEX IF EXISTS public.idx_prospect_people_tenant_status;
DROP INDEX IF EXISTS public.idx_prospect_enrichment_results_tenant;
DROP INDEX IF EXISTS public.idx_prospect_audit_log_tenant;
DROP INDEX IF EXISTS public.idx_prospect_opt_out_tenant;

-- NOTE: tenant_id columns are NOT dropped — data is preserved for re-application.

COMMIT;
