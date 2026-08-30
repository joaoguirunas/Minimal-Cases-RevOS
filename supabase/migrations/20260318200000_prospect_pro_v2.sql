-- ============================================================================
-- Prospect Pro v2 — LinkedIn Company Search + People Discovery
-- Story: prospect-v2.1
-- ============================================================================

-- 1. Add version column to prospect_campaigns (backward compat)
ALTER TABLE prospect_campaigns
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

-- New campaigns default to v2
ALTER TABLE prospect_campaigns ALTER COLUMN version SET DEFAULT 2;

-- 2. prospect_companies — LinkedIn company profiles
CREATE TABLE IF NOT EXISTS prospect_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES prospect_campaigns(id) ON DELETE CASCADE,

  -- LinkedIn data
  linkedin_url text,
  linkedin_id text,
  name text NOT NULL,
  industry text,
  description text,
  website text,
  headquarters text,
  employee_count_range text,
  founded_year int,
  specialties text[],
  logo_url text,

  -- Raw Apify output
  enrichment_data jsonb DEFAULT '{}',

  -- Status flow: raw → selected → people_fetched → reviewed → committed | rejected
  status text NOT NULL DEFAULT 'raw'
    CHECK (status IN ('raw', 'selected', 'people_fetched', 'reviewed', 'committed', 'rejected')),

  -- Link to CRM after commit
  company_id uuid,

  -- LGPD
  consent_basis text DEFAULT 'legitimate_interest'
    CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  data_retention_deadline timestamptz DEFAULT now() + interval '90 days',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(campaign_id, linkedin_id)
);

-- 3. prospect_people_v2 — LinkedIn people profiles
CREATE TABLE IF NOT EXISTS prospect_people_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES prospect_companies(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES prospect_campaigns(id) ON DELETE CASCADE,

  -- LinkedIn profile
  linkedin_url text,
  linkedin_id text,
  name text NOT NULL,
  headline text,
  role_title text,
  seniority text,
  department text,
  location text,
  profile_image_url text,

  -- Contact info
  email text,
  phone text,
  twitter_url text,

  -- Extensible enrichment (plugins write here)
  enrichment_data jsonb DEFAULT '{}',

  -- Status flow: discovered → selected → enriched → approved → rejected → committed
  status text NOT NULL DEFAULT 'discovered'
    CHECK (status IN ('discovered', 'selected', 'enriched', 'approved', 'rejected', 'committed')),

  -- Operator selection
  selected boolean DEFAULT false,
  selected_at timestamptz,

  -- Link to CRM after commit
  person_id uuid,

  -- LGPD
  consent_basis text DEFAULT 'legitimate_interest'
    CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  data_retention_deadline timestamptz DEFAULT now() + interval '90 days',

  created_at timestamptz DEFAULT now(),

  UNIQUE(campaign_id, linkedin_id)
);

-- 4. prospect_enrichment_plugins — Plugin registry (future extensibility)
CREATE TABLE IF NOT EXISTS prospect_enrichment_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  provider text NOT NULL,
  actor_id text,
  config_schema jsonb,
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 5. prospect_enrichment_results — Per-person plugin results
CREATE TABLE IF NOT EXISTS prospect_enrichment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES prospect_people_v2(id) ON DELETE CASCADE,
  plugin_id uuid NOT NULL REFERENCES prospect_enrichment_plugins(id),
  result jsonb NOT NULL,
  confidence numeric(3,2),
  created_at timestamptz DEFAULT now(),

  UNIQUE(person_id, plugin_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pc_campaign_status ON prospect_companies(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_pc_linkedin_id ON prospect_companies(linkedin_id) WHERE linkedin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pc_company_id ON prospect_companies(company_id) WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ppv2_company ON prospect_people_v2(company_id);
CREATE INDEX IF NOT EXISTS idx_ppv2_campaign_status ON prospect_people_v2(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_ppv2_role ON prospect_people_v2(role_title) WHERE role_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ppv2_seniority ON prospect_people_v2(seniority) WHERE seniority IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ppv2_selected ON prospect_people_v2(campaign_id, selected) WHERE selected = true;
CREATE INDEX IF NOT EXISTS idx_ppv2_email ON prospect_people_v2(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ppv2_person_id ON prospect_people_v2(person_id) WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_per_person ON prospect_enrichment_results(person_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE prospect_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_people_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_enrichment_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_enrichment_results ENABLE ROW LEVEL SECURITY;

-- prospect_companies
DROP POLICY IF EXISTS "prospect_companies_select" ON prospect_companies;
CREATE POLICY "prospect_companies_select" ON prospect_companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prospect_companies_insert" ON prospect_companies;
CREATE POLICY "prospect_companies_insert" ON prospect_companies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "prospect_companies_update" ON prospect_companies;
CREATE POLICY "prospect_companies_update" ON prospect_companies FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "prospect_companies_delete" ON prospect_companies;
CREATE POLICY "prospect_companies_delete" ON prospect_companies FOR DELETE TO authenticated USING (true);

-- prospect_people_v2
DROP POLICY IF EXISTS "prospect_people_v2_select" ON prospect_people_v2;
CREATE POLICY "prospect_people_v2_select" ON prospect_people_v2 FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prospect_people_v2_insert" ON prospect_people_v2;
CREATE POLICY "prospect_people_v2_insert" ON prospect_people_v2 FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "prospect_people_v2_update" ON prospect_people_v2;
CREATE POLICY "prospect_people_v2_update" ON prospect_people_v2 FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "prospect_people_v2_delete" ON prospect_people_v2;
CREATE POLICY "prospect_people_v2_delete" ON prospect_people_v2 FOR DELETE TO authenticated USING (true);

-- prospect_enrichment_plugins (read-only for authenticated, service_role manages)
DROP POLICY IF EXISTS "prospect_enrichment_plugins_select" ON prospect_enrichment_plugins;
CREATE POLICY "prospect_enrichment_plugins_select" ON prospect_enrichment_plugins FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prospect_enrichment_plugins_insert" ON prospect_enrichment_plugins;
CREATE POLICY "prospect_enrichment_plugins_insert" ON prospect_enrichment_plugins FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "prospect_enrichment_plugins_update" ON prospect_enrichment_plugins;
CREATE POLICY "prospect_enrichment_plugins_update" ON prospect_enrichment_plugins FOR UPDATE TO authenticated USING (true);

-- prospect_enrichment_results
DROP POLICY IF EXISTS "prospect_enrichment_results_select" ON prospect_enrichment_results;
CREATE POLICY "prospect_enrichment_results_select" ON prospect_enrichment_results FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prospect_enrichment_results_insert" ON prospect_enrichment_results;
CREATE POLICY "prospect_enrichment_results_insert" ON prospect_enrichment_results FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "prospect_enrichment_results_update" ON prospect_enrichment_results;
CREATE POLICY "prospect_enrichment_results_update" ON prospect_enrichment_results FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "prospect_enrichment_results_delete" ON prospect_enrichment_results;
CREATE POLICY "prospect_enrichment_results_delete" ON prospect_enrichment_results FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- Seed: placeholder enrichment plugin (disabled)
-- ============================================================================

INSERT INTO prospect_enrichment_plugins (name, display_name, provider, enabled)
VALUES ('income_estimator', 'Estimativa de Renda', 'custom', false)
ON CONFLICT (name) DO NOTHING;
