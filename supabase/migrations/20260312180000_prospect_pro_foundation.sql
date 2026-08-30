-- ============================================================
-- Prospect PRO™ — Foundation Migration
-- 4 novas tabelas + 13 colunas em clients_people + RLS + indexes
-- ============================================================

BEGIN;

-- ============================================================
-- 1. prospect_campaigns
-- Configuração de cada campanha de prospecção
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_campaigns (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  source              text        NOT NULL DEFAULT 'google_maps'
                        CHECK (source IN ('google_maps', 'manual')),
  actor_id            text        NOT NULL DEFAULT 'compass/crawler-google-places',
  actor_input         jsonb       NOT NULL DEFAULT '{}',
  max_leads           integer     NOT NULL DEFAULT 100 CHECK (max_leads > 0 AND max_leads <= 5000),
  target_pipeline_id  uuid        REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  target_stage_id     uuid        REFERENCES leads_stages(id) ON DELETE SET NULL,
  enrichment_config   jsonb       NOT NULL DEFAULT '{}',
  scoring_config      jsonb       NOT NULL DEFAULT '{}',
  status              text        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'running', 'completed', 'error', 'paused')),
  stats               jsonb       NOT NULL DEFAULT '{}',
  apify_run_id        text,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE prospect_campaigns IS
  'Prospect PRO: cada campanha de prospecção ativa (Google Maps / Apify)';
COMMENT ON COLUMN prospect_campaigns.actor_input IS
  'Parâmetros enviados ao Apify Actor (searchQuery, location, maxPlaces, etc.)';
COMMENT ON COLUMN prospect_campaigns.stats IS
  'Contadores: { total_raw, filtered, enriched, scored, approved, rejected, committed }';

-- ============================================================
-- 2. prospect_contacts
-- Contatos capturados em staging (antes de virar lead no CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_contacts (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             uuid        NOT NULL REFERENCES prospect_campaigns(id) ON DELETE CASCADE,

  -- Dados core
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

  -- Enriquecimento (dados brutos das camadas 3A/3B)
  enrichment_data         jsonb       NOT NULL DEFAULT '{}',

  -- AI Scoring
  ai_score                integer     CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_reasoning            text,
  ai_tags                 text[],

  -- Pipeline status
  status                  text        NOT NULL DEFAULT 'raw'
                            CHECK (status IN ('raw', 'filtered', 'enriched', 'scored', 'pending_review', 'approved', 'rejected')),

  -- Link CRM (preenchido após commit)
  person_id               uuid        REFERENCES clients_people(id) ON DELETE SET NULL,
  lead_id                 uuid        REFERENCES leads(id) ON DELETE SET NULL,

  -- LGPD
  consent_basis           text        NOT NULL DEFAULT 'legitimate_interest'
                            CHECK (consent_basis IN ('legitimate_interest', 'consent', 'public_data')),
  data_source             text,
  opt_out_requested       boolean     NOT NULL DEFAULT false,
  data_retention_deadline timestamptz,

  -- Revisão humana
  reviewed_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE prospect_contacts IS
  'Prospect PRO: contatos em staging capturados pelo Apify antes de entrar no CRM';
COMMENT ON COLUMN prospect_contacts.status IS
  'Pipeline: raw → filtered → enriched → scored → pending_review → approved/rejected';
COMMENT ON COLUMN prospect_contacts.enrichment_data IS
  'Dados brutos de enriquecimento (layers 3A contatos, 3B website)';

-- ============================================================
-- 3. prospect_opt_out_registry
-- LGPD: lista negra de hashes SHA-256
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_opt_out_registry (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash    text        UNIQUE,
  phone_hash    text        UNIQUE,
  source        text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_hash CHECK (email_hash IS NOT NULL OR phone_hash IS NOT NULL)
);

COMMENT ON TABLE prospect_opt_out_registry IS
  'LGPD: hashes SHA-256 de emails/telefones que solicitaram opt-out. Filtro aplicado em E2.';

-- ============================================================
-- 4. prospect_audit_log
-- Log imutável LGPD — sem UPDATE nem DELETE via RLS
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid        REFERENCES prospect_campaigns(id) ON DELETE SET NULL,
  contact_id  uuid,       -- sem FK: log sobrevive à exclusão do contato
  action      text        NOT NULL
                CHECK (action IN (
                  'scraped', 'filtered_out', 'enriched', 'scored',
                  'approved', 'rejected', 'committed',
                  'deleted_lgpd', 'opt_out_registered'
                )),
  actor       text        NOT NULL DEFAULT 'system',
  details     jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE prospect_audit_log IS
  'LGPD: log imutável de todas as ações de prospecção. Sem UPDATE/DELETE.';

-- ============================================================
-- 5. Indexes
-- ============================================================

-- prospect_campaigns
CREATE INDEX IF NOT EXISTS prospect_campaigns_status_idx
  ON prospect_campaigns(status);
CREATE INDEX IF NOT EXISTS prospect_campaigns_created_by_idx
  ON prospect_campaigns(created_by);

-- prospect_contacts
CREATE INDEX IF NOT EXISTS prospect_contacts_campaign_id_idx
  ON prospect_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS prospect_contacts_status_idx
  ON prospect_contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS prospect_contacts_person_id_idx
  ON prospect_contacts(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospect_contacts_ai_score_idx
  ON prospect_contacts(campaign_id, ai_score DESC) WHERE ai_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospect_contacts_opt_out_idx
  ON prospect_contacts(opt_out_requested) WHERE opt_out_requested = true;
CREATE INDEX IF NOT EXISTS prospect_contacts_retention_idx
  ON prospect_contacts(data_retention_deadline) WHERE data_retention_deadline IS NOT NULL;

-- prospect_opt_out_registry
CREATE INDEX IF NOT EXISTS prospect_opt_out_email_hash_idx
  ON prospect_opt_out_registry(email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospect_opt_out_phone_hash_idx
  ON prospect_opt_out_registry(phone_hash) WHERE phone_hash IS NOT NULL;

-- prospect_audit_log
CREATE INDEX IF NOT EXISTS prospect_audit_campaign_id_idx
  ON prospect_audit_log(campaign_id);
CREATE INDEX IF NOT EXISTS prospect_audit_contact_id_idx
  ON prospect_audit_log(contact_id);
CREATE INDEX IF NOT EXISTS prospect_audit_action_idx
  ON prospect_audit_log(action, created_at DESC);

-- ============================================================
-- 6. RLS
-- ============================================================

-- prospect_campaigns
ALTER TABLE prospect_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_campaigns_select" ON prospect_campaigns;
CREATE POLICY "prospect_campaigns_select"
  ON prospect_campaigns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prospect_campaigns_insert" ON prospect_campaigns;
CREATE POLICY "prospect_campaigns_insert"
  ON prospect_campaigns FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "prospect_campaigns_update" ON prospect_campaigns;
CREATE POLICY "prospect_campaigns_update"
  ON prospect_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "prospect_campaigns_delete" ON prospect_campaigns;
CREATE POLICY "prospect_campaigns_delete"
  ON prospect_campaigns FOR DELETE TO authenticated USING (true);

-- prospect_contacts
ALTER TABLE prospect_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_contacts_select" ON prospect_contacts;
CREATE POLICY "prospect_contacts_select"
  ON prospect_contacts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prospect_contacts_insert" ON prospect_contacts;
CREATE POLICY "prospect_contacts_insert"
  ON prospect_contacts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "prospect_contacts_update" ON prospect_contacts;
CREATE POLICY "prospect_contacts_update"
  ON prospect_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "prospect_contacts_delete" ON prospect_contacts;
CREATE POLICY "prospect_contacts_delete"
  ON prospect_contacts FOR DELETE TO authenticated USING (true);

-- prospect_opt_out_registry
ALTER TABLE prospect_opt_out_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_opt_out_select" ON prospect_opt_out_registry;
CREATE POLICY "prospect_opt_out_select"
  ON prospect_opt_out_registry FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prospect_opt_out_insert" ON prospect_opt_out_registry;
CREATE POLICY "prospect_opt_out_insert"
  ON prospect_opt_out_registry FOR INSERT TO authenticated WITH CHECK (true);

-- LGPD: sem UPDATE, sem DELETE para usuários normais (apenas service_role pode deletar)
-- prospect_audit_log: imutável — apenas INSERT
ALTER TABLE prospect_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_audit_select" ON prospect_audit_log;
CREATE POLICY "prospect_audit_select"
  ON prospect_audit_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prospect_audit_insert" ON prospect_audit_log;
CREATE POLICY "prospect_audit_insert"
  ON prospect_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 7. Triggers updated_at
-- ============================================================

CREATE OR REPLACE TRIGGER prospect_campaigns_updated_at
  BEFORE UPDATE ON prospect_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. ALTER TABLE clients_people — 13 novos campos de enriquecimento
-- ============================================================

ALTER TABLE clients_people
  ADD COLUMN IF NOT EXISTS prospect_campaign_id  uuid        REFERENCES prospect_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS google_place_id        text,
  ADD COLUMN IF NOT EXISTS google_maps_url        text,
  ADD COLUMN IF NOT EXISTS google_rating          decimal(2,1),
  ADD COLUMN IF NOT EXISTS google_review_count    integer,
  ADD COLUMN IF NOT EXISTS website                text,
  ADD COLUMN IF NOT EXISTS address                text,
  ADD COLUMN IF NOT EXISTS business_category      text,
  ADD COLUMN IF NOT EXISTS linkedin_url           text,
  ADD COLUMN IF NOT EXISTS facebook_url           text,
  ADD COLUMN IF NOT EXISTS youtube_url            text,
  ADD COLUMN IF NOT EXISTS company_description    text,
  ADD COLUMN IF NOT EXISTS enrichment_layers      text[];

COMMENT ON COLUMN clients_people.prospect_campaign_id IS
  'Prospect PRO: campanha de origem deste contato';
COMMENT ON COLUMN clients_people.google_place_id IS
  'ID do estabelecimento no Google Maps (via Apify)';
COMMENT ON COLUMN clients_people.google_rating IS
  'Nota média no Google (ex: 4.2). Fonte: Apify compass/crawler-google-places';
COMMENT ON COLUMN clients_people.enrichment_layers IS
  'Camadas de enriquecimento aplicadas (ex: [''google_maps'', ''contact_scraper''])';

-- Índice para lookup por campanha de origem
CREATE INDEX IF NOT EXISTS clients_people_prospect_campaign_id_idx
  ON clients_people(prospect_campaign_id) WHERE prospect_campaign_id IS NOT NULL;

-- ============================================================
-- 9. pg_cron: auto-delete LGPD (contatos expirados)
-- Executa diariamente às 03:00 UTC
-- ============================================================
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'prospect-lgpd-auto-delete',
      '0 3 * * *',
      $$
        -- Deleta contatos cujo prazo de retenção LGPD venceu
        -- e que não foram aprovados (sem person_id)
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
END $do$;

COMMIT;
