-- ============================================================
-- ROLLBACK: Prospect PRO™ — v1 Cleanup (Part 1)
-- Restores prospect_contacts, prospect_contacts_v, and original pg_cron job
-- ============================================================

BEGIN;

-- 1. Restore prospect_contacts table
CREATE TABLE IF NOT EXISTS public.prospect_contacts (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             uuid        NOT NULL REFERENCES prospect_campaigns(id) ON DELETE CASCADE,
  name                    text,
  email                   text,
  phone                   text,
  company                 text,
  role                    text,
  website                 text,
  address                 text,
  segment                 text,
  google_rating           decimal(2,1),
  google_review_count     integer,
  google_place_id         text,
  google_maps_url         text,
  enrichment_data         jsonb       NOT NULL DEFAULT '{}',
  ai_score                integer     CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_reasoning            text,
  ai_tags                 text[],
  status                  text        NOT NULL DEFAULT 'raw'
                            CHECK (status IN ('raw', 'filtered', 'enriched', 'scored', 'pending_review', 'approved', 'rejected')),
  person_id               uuid        REFERENCES clients_people(id) ON DELETE SET NULL,
  lead_id                 uuid        REFERENCES leads(id) ON DELETE SET NULL,
  consent_basis           text        NOT NULL DEFAULT 'legitimate_interest'
                            CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  data_source             text,
  opt_out_requested       boolean     NOT NULL DEFAULT false,
  data_retention_deadline timestamptz,
  reviewed_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospect_contacts_select"
  ON prospect_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospect_contacts_insert"
  ON prospect_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prospect_contacts_update"
  ON prospect_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prospect_contacts_delete"
  ON prospect_contacts FOR DELETE TO authenticated USING (true);

-- 2. Restore compatibility view
CREATE OR REPLACE VIEW public.prospect_contacts_v AS
SELECT
  pe.legacy_contact_id AS id,
  pe.campaign_id,
  pp.name,
  pp.email,
  pp.phone,
  pe.company,
  pp.role,
  pe.website,
  pe.address,
  pe.segment,
  pe.google_rating,
  pe.google_review_count,
  pe.google_place_id,
  pe.google_maps_url,
  pe.enrichment_data,
  pe.ai_score,
  pe.ai_reasoning,
  pe.ai_tags,
  pe.status,
  pp.person_id,
  pe.lead_id,
  pe.consent_basis,
  pe.data_source,
  COALESCE(pp.opt_out_requested, pe.opt_out_requested) AS opt_out_requested,
  COALESCE(pp.data_retention_deadline, pe.data_retention_deadline) AS data_retention_deadline,
  pe.reviewed_by,
  pe.reviewed_at,
  pe.created_at
FROM public.prospect_establishments pe
LEFT JOIN public.prospect_people pp
  ON pp.establishment_id = pe.id;

-- 3. Restore original pg_cron job (targeting prospect_contacts)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prospect-lgpd-auto-delete',
      '0 3 * * *',
      $$
        INSERT INTO prospect_audit_log (campaign_id, contact_id, action, actor, details)
        SELECT campaign_id, id, 'deleted_lgpd', 'system',
               jsonb_build_object('reason', 'data_retention_expired', 'deleted_at', now())
        FROM prospect_contacts
        WHERE data_retention_deadline < now()
          AND person_id IS NULL
          AND status NOT IN ('approved');

        DELETE FROM prospect_contacts
        WHERE data_retention_deadline < now()
          AND person_id IS NULL
          AND status NOT IN ('approved');
      $$
    );
  END IF;
END $$;

COMMIT;
