-- ============================================================
-- Prospect PRO™ — Tenant Isolation
-- Adds tenant_id to all prospect tables + RLS policies scoped by tenant
--
-- Depends on:
--   - 20260422000500_prospect_rename_people_v2 (prospect_people exists)
--   - public.get_current_user_tenant_id() (defined in CRM migrations)
--   - public.user_has_tenant_access(uuid) (defined in CRM migrations)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Add tenant_id column to all prospect tables
-- ============================================================

ALTER TABLE public.prospect_campaigns
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.prospect_companies
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.prospect_people
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.prospect_enrichment_results
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.prospect_audit_log
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

ALTER TABLE public.prospect_opt_out_registry
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.crm_tenants(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Backfill tenant_id from existing data
-- ============================================================

-- prospect_campaigns: backfill tenant_id if crm_usuarios exists (older tenants)
-- New tenants will have empty prospect_campaigns so this is a no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='crm_usuarios') THEN
    UPDATE public.prospect_campaigns pc
    SET tenant_id = cu.tenant_id
    FROM public.crm_usuarios cu
    WHERE pc.created_by = cu.auth_user_id
      AND pc.tenant_id IS NULL;
  END IF;
END;
$$;

-- Report unresolved campaigns (no created_by match)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.prospect_campaigns
  WHERE tenant_id IS NULL;
  IF v_count > 0 THEN
    RAISE WARNING '[prospect_tenant_isolation] % campaign(s) could not be backfilled (no created_by match). Escalate to Chief: delete, move to default tenant, or keep NULL.', v_count;
  END IF;
END $$;

-- prospect_companies: derive from parent campaign
UPDATE public.prospect_companies pc
SET tenant_id = camp.tenant_id
FROM public.prospect_campaigns camp
WHERE pc.campaign_id = camp.id
  AND camp.tenant_id IS NOT NULL
  AND pc.tenant_id IS NULL;

-- prospect_people: derive from parent campaign
UPDATE public.prospect_people pp
SET tenant_id = camp.tenant_id
FROM public.prospect_campaigns camp
WHERE pp.campaign_id = camp.id
  AND camp.tenant_id IS NOT NULL
  AND pp.tenant_id IS NULL;

-- prospect_enrichment_results: derive via person → campaign
UPDATE public.prospect_enrichment_results per
SET tenant_id = camp.tenant_id
FROM public.prospect_people pp
JOIN public.prospect_campaigns camp ON pp.campaign_id = camp.id
WHERE per.person_id = pp.id
  AND camp.tenant_id IS NOT NULL
  AND per.tenant_id IS NULL;

-- prospect_audit_log: derive from campaign
UPDATE public.prospect_audit_log pal
SET tenant_id = camp.tenant_id
FROM public.prospect_campaigns camp
WHERE pal.campaign_id = camp.id
  AND camp.tenant_id IS NOT NULL
  AND pal.tenant_id IS NULL;

-- prospect_opt_out_registry: per-tenant (ADR-PP-02 decision: per-tenant, not global)
-- No automatic backfill possible — no campaign link. Leave NULL; NOT NULL enforced after human review.

-- ============================================================
-- 3. Set NOT NULL on tenant_id (fails deliberately if NULLs remain)
--    Exception: prospect_opt_out_registry stays nullable until human review
-- ============================================================

ALTER TABLE public.prospect_campaigns
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.prospect_companies
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.prospect_people
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.prospect_enrichment_results
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.prospect_audit_log
  ALTER COLUMN tenant_id SET NOT NULL;

-- prospect_opt_out_registry: nullable — human decision pending on orphaned records

-- ============================================================
-- 4. Indexes for tenant-scoped queries (avoid full-scan post-RLS)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_prospect_campaigns_tenant
  ON public.prospect_campaigns(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prospect_campaigns_tenant_status
  ON public.prospect_campaigns(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_prospect_companies_tenant
  ON public.prospect_companies(tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_prospect_companies_tenant_status
  ON public.prospect_companies(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_prospect_people_tenant
  ON public.prospect_people(tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_prospect_people_tenant_status
  ON public.prospect_people(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_prospect_enrichment_results_tenant
  ON public.prospect_enrichment_results(tenant_id);

CREATE INDEX IF NOT EXISTS idx_prospect_audit_log_tenant
  ON public.prospect_audit_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prospect_opt_out_tenant
  ON public.prospect_opt_out_registry(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================
-- 5. Drop old permissive RLS policies
-- ============================================================

-- prospect_campaigns
DROP POLICY IF EXISTS "prospect_campaigns_select" ON public.prospect_campaigns;
DROP POLICY IF EXISTS "prospect_campaigns_insert" ON public.prospect_campaigns;
DROP POLICY IF EXISTS "prospect_campaigns_update" ON public.prospect_campaigns;
DROP POLICY IF EXISTS "prospect_campaigns_delete" ON public.prospect_campaigns;

-- prospect_companies
DROP POLICY IF EXISTS "prospect_companies_select" ON public.prospect_companies;
DROP POLICY IF EXISTS "prospect_companies_insert" ON public.prospect_companies;
DROP POLICY IF EXISTS "prospect_companies_update" ON public.prospect_companies;
DROP POLICY IF EXISTS "prospect_companies_delete" ON public.prospect_companies;

-- prospect_people (renamed from prospect_people_v2 in migration 000500)
DROP POLICY IF EXISTS "prospect_people_select" ON public.prospect_people;
DROP POLICY IF EXISTS "prospect_people_insert" ON public.prospect_people;
DROP POLICY IF EXISTS "prospect_people_update" ON public.prospect_people;
DROP POLICY IF EXISTS "prospect_people_delete" ON public.prospect_people;

-- prospect_enrichment_results
DROP POLICY IF EXISTS "prospect_enrichment_results_select" ON public.prospect_enrichment_results;
DROP POLICY IF EXISTS "prospect_enrichment_results_insert" ON public.prospect_enrichment_results;
DROP POLICY IF EXISTS "prospect_enrichment_results_update" ON public.prospect_enrichment_results;

-- prospect_audit_log
DROP POLICY IF EXISTS "prospect_audit_select" ON public.prospect_audit_log;
DROP POLICY IF EXISTS "prospect_audit_insert" ON public.prospect_audit_log;

-- prospect_opt_out_registry
DROP POLICY IF EXISTS "prospect_opt_out_select" ON public.prospect_opt_out_registry;
DROP POLICY IF EXISTS "prospect_opt_out_insert" ON public.prospect_opt_out_registry;

-- ============================================================
-- 6. Create tenant-scoped RLS policies
-- ============================================================

-- prospect_campaigns
CREATE POLICY "prospect_campaigns_select"
  ON public.prospect_campaigns FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "prospect_campaigns_insert"
  ON public.prospect_campaigns FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "prospect_campaigns_update"
  ON public.prospect_campaigns FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "prospect_campaigns_delete"
  ON public.prospect_campaigns FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- prospect_companies
CREATE POLICY "prospect_companies_select"
  ON public.prospect_companies FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "prospect_companies_insert"
  ON public.prospect_companies FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "prospect_companies_update"
  ON public.prospect_companies FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "prospect_companies_delete"
  ON public.prospect_companies FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- prospect_people
CREATE POLICY "prospect_people_select"
  ON public.prospect_people FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "prospect_people_insert"
  ON public.prospect_people FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "prospect_people_update"
  ON public.prospect_people FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "prospect_people_delete"
  ON public.prospect_people FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- prospect_enrichment_results: no tenant-scoped INSERT check needed (service_role writes)
-- SELECT filtered by tenant; UPDATE/INSERT via service_role bypass RLS
CREATE POLICY "prospect_enrichment_results_select"
  ON public.prospect_enrichment_results FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "prospect_enrichment_results_insert"
  ON public.prospect_enrichment_results FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "prospect_enrichment_results_update"
  ON public.prospect_enrichment_results FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- prospect_audit_log: LGPD immutable — INSERT-only for authenticated; SELECT scoped by tenant
CREATE POLICY "prospect_audit_select"
  ON public.prospect_audit_log FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "prospect_audit_insert"
  ON public.prospect_audit_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

-- prospect_opt_out_registry: per-tenant (ADR-PP-02)
-- tenant_id is nullable here — rows with tenant_id NULL are treated as global (visible to all)
CREATE POLICY "prospect_opt_out_select"
  ON public.prospect_opt_out_registry FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id));

CREATE POLICY "prospect_opt_out_insert"
  ON public.prospect_opt_out_registry FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id() OR tenant_id IS NULL);

COMMIT;
