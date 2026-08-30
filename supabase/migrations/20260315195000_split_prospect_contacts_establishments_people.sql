-- ============================================================
-- Prospect PRO™ — PP-01
-- Split prospect_contacts -> prospect_establishments + prospect_people
-- Idempotent, compatibility-first migration
-- ============================================================

BEGIN;

-- ============================================================
-- 1) New table: prospect_establishments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospect_establishments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             uuid        NOT NULL REFERENCES public.prospect_campaigns(id) ON DELETE CASCADE,

  -- Legacy mapping for idempotent migration / temporary compatibility
  legacy_contact_id       uuid        UNIQUE,

  -- Establishment / place data
  company                 text,
  segment                 text,
  google_place_id         text,
  google_maps_url         text,
  google_rating           decimal(2,1),
  google_review_count     integer,
  address                 text,
  website                 text,

  -- Enrichment + scoring (establishment-level)
  enrichment_data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ai_score                integer     CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_reasoning            text,
  ai_tags                 text[],

  -- Pipeline status
  status                  text        NOT NULL DEFAULT 'raw'
                            CHECK (status IN ('raw', 'enriched', 'scored', 'pending_review', 'approved', 'rejected')),

  -- CRM links
  company_id              uuid        REFERENCES public.clients_companies(id) ON DELETE SET NULL,
  lead_id                 uuid        REFERENCES public.leads(id) ON DELETE SET NULL,

  -- LGPD / governance
  consent_basis           text        NOT NULL DEFAULT 'legitimate_interest'
                            CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  data_source             text,
  opt_out_requested       boolean     NOT NULL DEFAULT false,
  data_retention_deadline timestamptz,

  -- Human review
  reviewed_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prospect_establishments IS
  'Prospect PRO: staging de estabelecimentos/lugares (Google Maps / Apify), separados de pessoas.';
COMMENT ON COLUMN public.prospect_establishments.legacy_contact_id IS
  'ID original de prospect_contacts para migração idempotente e compatibilidade temporária.';
COMMENT ON COLUMN public.prospect_establishments.lead_id IS
  'Campo legado temporário para preservar shape/compatibilidade de prospect_contacts durante a transição.';

-- ============================================================
-- 2) New table: prospect_people
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospect_people (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id        uuid        NOT NULL REFERENCES public.prospect_establishments(id) ON DELETE CASCADE,

  -- Legacy mapping for idempotent migration / temporary compatibility
  legacy_contact_id       uuid,

  -- Person/contact data
  name                    text,
  email                   text,
  phone                   text,
  role                    text,
  linkedin_url            text,
  facebook_url            text,
  source                  text,

  -- Raw enrichment from source/layer that found the person
  enrichment_data         jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- CRM link
  person_id               uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,

  -- LGPD / governance
  consent_basis           text        NOT NULL DEFAULT 'legitimate_interest'
                            CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  opt_out_requested       boolean     NOT NULL DEFAULT false,
  data_retention_deadline timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT prospect_people_has_some_identity CHECK (
    name IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL
  )
);

COMMENT ON TABLE public.prospect_people IS
  'Prospect PRO: pessoas/contatos enriquecidos e vinculados a um establishment.';
COMMENT ON COLUMN public.prospect_people.legacy_contact_id IS
  'ID original de prospect_contacts quando a pessoa veio da migração inicial.';

-- ============================================================
-- 3) Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_prospect_establishments_campaign_status
  ON public.prospect_establishments(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_prospect_establishments_place_id
  ON public.prospect_establishments(google_place_id);

CREATE INDEX IF NOT EXISTS idx_prospect_establishments_company_id
  ON public.prospect_establishments(company_id)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_establishments_legacy_contact_id
  ON public.prospect_establishments(legacy_contact_id)
  WHERE legacy_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_people_establishment
  ON public.prospect_people(establishment_id);

CREATE INDEX IF NOT EXISTS idx_prospect_people_email
  ON public.prospect_people(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_people_person_id
  ON public.prospect_people(person_id)
  WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_people_legacy_contact_id
  ON public.prospect_people(legacy_contact_id)
  WHERE legacy_contact_id IS NOT NULL;

-- ============================================================
-- 4) updated_at trigger for prospect_establishments
-- ============================================================
DROP TRIGGER IF EXISTS prospect_establishments_updated_at ON public.prospect_establishments;
CREATE TRIGGER prospect_establishments_updated_at
  BEFORE UPDATE ON public.prospect_establishments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) RLS
-- Replicates existing prospect_contacts permissive pattern.
-- Edge functions use service_role (bypass RLS).
-- Frontend queries use authenticated user JWT.
-- ============================================================
ALTER TABLE public.prospect_establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_people ENABLE ROW LEVEL SECURITY;

-- prospect_establishments: same permissive pattern as prospect_contacts
DROP POLICY IF EXISTS prospect_establishments_select ON public.prospect_establishments;
CREATE POLICY prospect_establishments_select
  ON public.prospect_establishments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS prospect_establishments_insert ON public.prospect_establishments;
CREATE POLICY prospect_establishments_insert
  ON public.prospect_establishments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS prospect_establishments_update ON public.prospect_establishments;
CREATE POLICY prospect_establishments_update
  ON public.prospect_establishments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS prospect_establishments_delete ON public.prospect_establishments;
CREATE POLICY prospect_establishments_delete
  ON public.prospect_establishments FOR DELETE TO authenticated USING (true);

-- prospect_people: same permissive pattern
DROP POLICY IF EXISTS prospect_people_select ON public.prospect_people;
CREATE POLICY prospect_people_select
  ON public.prospect_people FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS prospect_people_insert ON public.prospect_people;
CREATE POLICY prospect_people_insert
  ON public.prospect_people FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS prospect_people_update ON public.prospect_people;
CREATE POLICY prospect_people_update
  ON public.prospect_people FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS prospect_people_delete ON public.prospect_people;
CREATE POLICY prospect_people_delete
  ON public.prospect_people FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 6) Audit log compatibility: add establishment_id, preserve contact_id
-- ============================================================
ALTER TABLE public.prospect_audit_log
  ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.prospect_establishments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prospect_audit_establishment_id_idx
  ON public.prospect_audit_log(establishment_id);

-- Backfill establishment_id for legacy audit rows when possible
UPDATE public.prospect_audit_log pal
SET establishment_id = pe.id
FROM public.prospect_establishments pe
WHERE pal.establishment_id IS NULL
  AND pal.contact_id IS NOT NULL
  AND pe.legacy_contact_id = pal.contact_id;

-- ============================================================
-- 7) Data migration from prospect_contacts -> new tables
-- Keep prospect_contacts intact in PP-01.
-- ============================================================
INSERT INTO public.prospect_establishments (
  campaign_id,
  legacy_contact_id,
  company,
  segment,
  google_place_id,
  google_maps_url,
  google_rating,
  google_review_count,
  address,
  website,
  enrichment_data,
  ai_score,
  ai_reasoning,
  ai_tags,
  status,
  company_id,
  lead_id,
  consent_basis,
  data_source,
  opt_out_requested,
  data_retention_deadline,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
)
SELECT
  pc.campaign_id,
  pc.id,
  pc.company,
  pc.segment,
  pc.google_place_id,
  pc.google_maps_url,
  pc.google_rating,
  pc.google_review_count,
  pc.address,
  pc.website,
  COALESCE(pc.enrichment_data, '{}'::jsonb),
  pc.ai_score,
  pc.ai_reasoning,
  pc.ai_tags,
  CASE WHEN pc.status = 'filtered' THEN 'enriched' ELSE pc.status END,
  NULL::uuid AS company_id,
  pc.lead_id,
  pc.consent_basis,
  pc.data_source,
  COALESCE(pc.opt_out_requested, false),
  pc.data_retention_deadline,
  pc.reviewed_by,
  pc.reviewed_at,
  pc.created_at,
  COALESCE(pc.reviewed_at, pc.created_at, now())
FROM public.prospect_contacts pc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.prospect_establishments pe
  WHERE pe.legacy_contact_id = pc.id
);

INSERT INTO public.prospect_people (
  establishment_id,
  legacy_contact_id,
  name,
  email,
  phone,
  role,
  source,
  enrichment_data,
  person_id,
  consent_basis,
  opt_out_requested,
  data_retention_deadline,
  created_at
)
SELECT
  pe.id,
  pc.id,
  pc.name,
  pc.email,
  pc.phone,
  pc.role,
  'legacy_prospect_contacts_migration'::text,
  COALESCE(pc.enrichment_data, '{}'::jsonb),
  pc.person_id,
  pc.consent_basis,
  COALESCE(pc.opt_out_requested, false),
  pc.data_retention_deadline,
  pc.created_at
FROM public.prospect_contacts pc
JOIN public.prospect_establishments pe
  ON pe.legacy_contact_id = pc.id
WHERE (pc.name IS NOT NULL OR pc.email IS NOT NULL OR pc.phone IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM public.prospect_people pp
    WHERE pp.legacy_contact_id = pc.id
      AND pp.establishment_id = pe.id
  );

-- Re-run audit backfill after establishment migration
UPDATE public.prospect_audit_log pal
SET establishment_id = pe.id
FROM public.prospect_establishments pe
WHERE pal.establishment_id IS NULL
  AND pal.contact_id IS NOT NULL
  AND pe.legacy_contact_id = pal.contact_id;

-- ============================================================
-- 8) Compatibility view
-- Same shape as legacy prospect_contacts, now projected from split tables.
-- ============================================================
DROP VIEW IF EXISTS public.prospect_contacts_v;
CREATE VIEW public.prospect_contacts_v AS
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

COMMENT ON VIEW public.prospect_contacts_v IS
  'Compatibility view during Prospect PRO split migration (PP-01).';

COMMIT;
