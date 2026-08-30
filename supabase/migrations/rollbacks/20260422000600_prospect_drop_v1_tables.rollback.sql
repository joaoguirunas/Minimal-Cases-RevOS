-- ============================================================
-- ROLLBACK: Prospect PRO™ — Drop v1 tables
-- Restores prospect_establishments and prospect_people (v1)
-- NOTE: Data cannot be restored via rollback — only schema.
-- Must restore from backup if data recovery is needed.
-- ============================================================

BEGIN;

-- Restore prospect_establishments
CREATE TABLE IF NOT EXISTS public.prospect_establishments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             uuid        NOT NULL REFERENCES public.prospect_campaigns(id) ON DELETE CASCADE,
  legacy_contact_id       uuid        UNIQUE,
  company                 text,
  segment                 text,
  google_place_id         text,
  google_maps_url         text,
  google_rating           decimal(2,1),
  google_review_count     integer,
  address                 text,
  website                 text,
  enrichment_data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ai_score                integer     CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_reasoning            text,
  ai_tags                 text[],
  status                  text        NOT NULL DEFAULT 'raw'
                            CHECK (status IN ('raw', 'enriched', 'scored', 'pending_review', 'approved', 'rejected', 'committed', 'partial_error')),
  company_id              uuid        REFERENCES public.clients_companies(id) ON DELETE SET NULL,
  lead_id                 uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  consent_basis           text        NOT NULL DEFAULT 'legitimate_interest'
                            CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  data_source             text,
  opt_out_requested       boolean     NOT NULL DEFAULT false,
  data_retention_deadline timestamptz,
  reviewed_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY prospect_establishments_select ON public.prospect_establishments FOR SELECT TO authenticated USING (true);
CREATE POLICY prospect_establishments_insert ON public.prospect_establishments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY prospect_establishments_update ON public.prospect_establishments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY prospect_establishments_delete ON public.prospect_establishments FOR DELETE TO authenticated USING (true);

-- Restore prospect_people_legacy (was prospect_people v1)
CREATE TABLE IF NOT EXISTS public.prospect_people_legacy (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id        uuid        NOT NULL REFERENCES public.prospect_establishments(id) ON DELETE CASCADE,
  legacy_contact_id       uuid,
  name                    text,
  email                   text,
  phone                   text,
  role                    text,
  linkedin_url            text,
  facebook_url            text,
  source                  text,
  enrichment_data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  person_id               uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  consent_basis           text        NOT NULL DEFAULT 'legitimate_interest'
                            CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  opt_out_requested       boolean     NOT NULL DEFAULT false,
  data_retention_deadline timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_people_legacy_has_some_identity CHECK (
    name IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL
  )
);

ALTER TABLE public.prospect_people_legacy ENABLE ROW LEVEL SECURITY;
CREATE POLICY prospect_people_legacy_select ON public.prospect_people_legacy FOR SELECT TO authenticated USING (true);
CREATE POLICY prospect_people_legacy_insert ON public.prospect_people_legacy FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY prospect_people_legacy_update ON public.prospect_people_legacy FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY prospect_people_legacy_delete ON public.prospect_people_legacy FOR DELETE TO authenticated USING (true);

-- Restore FK constraint on prospect_audit_log
ALTER TABLE public.prospect_audit_log
  ADD CONSTRAINT prospect_audit_log_establishment_id_fkey
  FOREIGN KEY (establishment_id) REFERENCES public.prospect_establishments(id) ON DELETE SET NULL;

-- Restore pg_cron job targeting prospect_establishments.
-- NOTE: partial rollback — schema is restored but data is not.
-- If data recovery is needed, restore from backup taken before migration 000600.
-- Job body matches the version set by migration 20260422000400.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prospect-lgpd-auto-delete',
      '0 3 * * *',
      $$
        INSERT INTO prospect_audit_log (campaign_id, establishment_id, action, actor, details)
        SELECT campaign_id, id, 'deleted_lgpd', 'system',
               jsonb_build_object('reason', 'data_retention_expired', 'deleted_at', now())
        FROM prospect_establishments
        WHERE data_retention_deadline < now()
          AND company_id IS NULL
          AND status NOT IN ('approved', 'committed');

        DELETE FROM prospect_establishments
        WHERE data_retention_deadline < now()
          AND company_id IS NULL
          AND status NOT IN ('approved', 'committed');
      $$
    );
  END IF;
END $$;

COMMIT;
