-- KFY-1.1: Kiwify integration schema (connections / webhook_events / event_mappings
--          / message_automations / message_jobs) + RLS + indexes + seeds.
--
-- Reference architecture: docs/smart-memory/project/kiwify-integration-architecture.md (§3)
-- Decision: docs/smart-memory/decisions/ADR-KFY-01-reuse-vs-dedicated-queue.md
--
-- DRIFT NOTE (live-verified 2026-07-02, project wotuyxscsfralqpoiyfv):
--   Three abandoned draft tables existed ad-hoc (NOT registered in
--   supabase_migrations.schema_migrations), all EMPTY (0 rows), unreferenced by any
--   edge function or app code, with shapes divergent from the ratified KFY architecture:
--     - kiwify_event_mappings     (used `kiwify_product_id`, nullable targets, no updated_at)
--     - kiwify_webhook_events     (single `idempotency_key` instead of composite dedup)
--     - kiwify_pending_automations (superseded by kiwify_message_jobs per ADR-KFY-01)
--   They are DROPPED here and rebuilt to spec. No data loss (all empty, no deps).
--
-- Encryption: secrets stored ONLY as `*_enc` via app_encrypt_secret(value, 'kiwify_'||account_id)
--   (helpers from 20260325210000_adm_secrets_encryption.sql). No plaintext secret columns.
--
-- Apply: supabase db query --linked --file <this> ; then register in schema_migrations.

BEGIN;

-- ── 0. Drop divergent draft tables (empty, unreferenced, unregistered) ───────
DROP TABLE IF EXISTS public.kiwify_pending_automations CASCADE;
DROP TABLE IF EXISTS public.kiwify_webhook_events       CASCADE;
DROP TABLE IF EXISTS public.kiwify_event_mappings       CASCADE;

-- ── 1. kiwify_connections ────────────────────────────────────────────────────
CREATE TABLE public.kiwify_connections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         text NOT NULL UNIQUE,          -- x-kiwify-account-id
  client_secret_enc  text NOT NULL,                 -- app_encrypt_secret(secret,'kiwify_'||account_id)
  access_token_enc   text,                          -- OAuth cache (encrypted)
  token_expires_at   timestamptz,
  webhook_id         text,                          -- id from POST /v1/webhooks
  webhook_token_enc  text,                          -- webhook token (encrypted)
  enforce_signature  boolean NOT NULL DEFAULT false,-- gate do 401-reject (KFY-1.4)
  status             text NOT NULL DEFAULT 'disconnected'
                       CHECK (status IN ('disconnected','connected','error')),
  last_error         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.kiwify_connections IS 'Kiwify account connection (single-tenant). Secrets encrypted via app_encrypt_secret with context ''kiwify_''||account_id.';
COMMENT ON COLUMN public.kiwify_connections.enforce_signature IS 'When true, kiwify-inbound rejects invalid signatures with 401 (KFY-1.4). Default false until signature mechanism is confirmed against a real webhook.';
COMMENT ON COLUMN public.kiwify_connections.client_secret_enc IS 'Encrypted OAuth client_secret. Never store plaintext.';

CREATE TRIGGER kiwify_connections_set_updated_at
  BEFORE UPDATE ON public.kiwify_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. kiwify_webhook_events (raw log + composite idempotency) ────────────────
CREATE TABLE public.kiwify_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES public.kiwify_connections(id) ON DELETE CASCADE,
  trigger         text,                    -- trigger name from webhook config
  event_type      text NOT NULL,           -- webhook_event_type from payload (may differ from trigger)
  order_id        text,                    -- nullable (carrinho_abandonado has none)
  subscription_id text,                    -- nullable (subscription events)
  dedup_key       text NOT NULL,           -- order_id | subscription_id||'|'||charge_date | md5(email||product_id||checkout_id?)
  raw_payload     jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','processing','processed','failed','ignored')),
  processed_at    timestamptz,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kiwify_webhook_events_idem UNIQUE (connection_id, event_type, dedup_key)
);

COMMENT ON TABLE  public.kiwify_webhook_events IS 'Raw inbound webhook log + idempotency. UNIQUE(connection_id,event_type,dedup_key) dedupes Kiwify retries while allowing legit status transitions of the same order_id.';
COMMENT ON COLUMN public.kiwify_webhook_events.dedup_key IS 'order_id (orders) | subscription_id||''|''||charge_date (subscriptions) | md5(email||product_id||checkout_id?) (cart). Stable-field for cart is TODO(verify) against real payload.';

CREATE INDEX kiwify_webhook_events_order_id_idx ON public.kiwify_webhook_events (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX kiwify_webhook_events_status_idx   ON public.kiwify_webhook_events (status);
CREATE INDEX kiwify_webhook_events_created_idx  ON public.kiwify_webhook_events (created_at DESC);

-- ── 3. kiwify_event_mappings (trigger → pipeline/stage) ───────────────────────
CREATE TABLE public.kiwify_event_mappings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         text,                  -- NULL = default for the trigger
  trigger            text NOT NULL,
  target_pipeline_id uuid NOT NULL REFERENCES public.leads_pipelines(id),
  target_stage_id    uuid NOT NULL REFERENCES public.leads_stages(id),
  tags_to_add        text[] NOT NULL DEFAULT '{}',
  tags_to_remove     text[] NOT NULL DEFAULT '{}',
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kiwify_event_mappings IS 'Maps a Kiwify trigger (optionally per product_id) to a target pipeline/stage. product_id NULL = default.';

-- partial unique: one default per trigger, one row per (product_id, trigger)
CREATE UNIQUE INDEX kiwify_event_mappings_default_uq
  ON public.kiwify_event_mappings (trigger) WHERE product_id IS NULL;
CREATE UNIQUE INDEX kiwify_event_mappings_product_uq
  ON public.kiwify_event_mappings (product_id, trigger) WHERE product_id IS NOT NULL;

CREATE TRIGGER kiwify_event_mappings_set_updated_at
  BEFORE UPDATE ON public.kiwify_event_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 4. kiwify_message_automations (flow definitions) ──────────────────────────
CREATE TABLE public.kiwify_message_automations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         text,                  -- NULL = default
  trigger            text NOT NULL,
  steps              jsonb NOT NULL,        -- [{delay_minutes, template_id, variables:{}}]
  cancel_on_triggers text[] NOT NULL DEFAULT '{}',
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.kiwify_message_automations IS 'WhatsApp automation flows per trigger. steps = ordered [{delay_minutes, template_id, variables}]; cancel_on_triggers halts pending jobs when a later trigger arrives.';
COMMENT ON COLUMN public.kiwify_message_automations.steps IS 'template_id may be null in seeds until the real WhatsApp template is assigned (KFY-1.5 config).';

CREATE UNIQUE INDEX kiwify_message_automations_default_uq
  ON public.kiwify_message_automations (trigger) WHERE product_id IS NULL;
CREATE UNIQUE INDEX kiwify_message_automations_product_uq
  ON public.kiwify_message_automations (product_id, trigger) WHERE product_id IS NOT NULL;

CREATE TRIGGER kiwify_message_automations_set_updated_at
  BEFORE UPDATE ON public.kiwify_message_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. kiwify_message_jobs (runtime queue — mirrors followup_queue) ───────────
CREATE TABLE public.kiwify_message_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid REFERENCES public.kiwify_webhook_events(id) ON DELETE SET NULL,
  automation_id      uuid REFERENCES public.kiwify_message_automations(id) ON DELETE SET NULL,
  people_id          uuid REFERENCES public.clients_people(id) ON DELETE CASCADE,
  lead_id            uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  order_id           text,
  trigger            text NOT NULL,
  step_index         int NOT NULL,
  template_id        text,
  variables          jsonb,
  cancel_on_triggers text[] NOT NULL DEFAULT '{}',
  scheduled_for      timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','sent','failed','cancelled','skipped_no_optin')),
  message_id         bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  retry_count        int NOT NULL DEFAULT 0,
  error_message      text,
  fired_at           timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kiwify_message_jobs IS 'Runtime WhatsApp job queue for Kiwify automations. Dedicated (not followup_queue) per ADR-KFY-01. Dispatched by kiwify-dispatch-worker (pg_cron 1min) via whatsapp-outbound.';

CREATE INDEX kiwify_message_jobs_due_idx    ON public.kiwify_message_jobs (scheduled_for) WHERE status = 'pending';
CREATE INDEX kiwify_message_jobs_order_idx  ON public.kiwify_message_jobs (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX kiwify_message_jobs_people_idx ON public.kiwify_message_jobs (people_id);
CREATE INDEX kiwify_message_jobs_event_idx  ON public.kiwify_message_jobs (event_id);

CREATE TRIGGER kiwify_message_jobs_set_updated_at
  BEFORE UPDATE ON public.kiwify_message_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 6. RLS (SELECT = active settings_users; WRITE = gestor/super_admin or service_role) ──
DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kiwify_connections','kiwify_webhook_events','kiwify_event_mappings',
    'kiwify_message_automations','kiwify_message_jobs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format($p$
      CREATE POLICY "kiwify_select_active_users" ON public.%I
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid() AND su.active = true)
        );$p$, t);

    EXECUTE format($p$
      CREATE POLICY "kiwify_write_managers" ON public.%I
        FOR ALL USING (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid() AND su.active = true
                    AND (su.super_admin = true OR su.user_type = 'gestor'))
        ) WITH CHECK (
          EXISTS (SELECT 1 FROM public.settings_users su
                  WHERE su.auth_user_id = auth.uid() AND su.active = true
                    AND (su.super_admin = true OR su.user_type = 'gestor'))
        );$p$, t);

    EXECUTE format($p$
      CREATE POLICY "kiwify_service_role" ON public.%I
        FOR ALL USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');$p$, t);
  END LOOP;
END
$rls$;

-- ── 7. clients_people.whatsapp_optin (additive; gating lives in KFY-1.5) ──────
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS whatsapp_optin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients_people.whatsapp_optin IS 'Explicit WhatsApp marketing opt-in. KFY-1.5 gate: UTILITY templates send always; MARKETING (or missing category) only when true.';

-- ── 8. New stages for uncovered triggers (pipeline "Cursos Online") ───────────
-- Lead/user decision (2026-07-02): full 10/10 trigger coverage. Create a dedicated
-- stage per negative-outcome trigger. subscription_renewed reuses existing "Em Andamento".
INSERT INTO public.leads_stages (id, leads_pipelines_id, name, color, order_index, active) VALUES
  ('3130aa19-7d22-4820-b372-d59d1a9a01ec', 'f8aae630-649e-49c0-93c6-bd8199682410', 'Reembolsado',           '#F97316', 11, true),
  ('812c33ce-a788-4d6a-b20a-cc1a90027d37', 'f8aae630-649e-49c0-93c6-bd8199682410', 'Chargeback',            '#DC2626', 12, true),
  ('485dfe05-ed94-445c-99b3-36ed424918fb', 'f8aae630-649e-49c0-93c6-bd8199682410', 'Assinatura Cancelada',  '#6B7280', 13, true),
  ('1a559fcf-8348-4e10-944c-f7034711cdde', 'f8aae630-649e-49c0-93c6-bd8199682410', 'Inadimplente',          '#B91C1C', 14, true);

-- ── 9. Seed kiwify_event_mappings (default, product_id NULL) — 10/10 triggers ──
-- Pipeline "Cursos Online" (f8aae630-649e-49c0-93c6-bd8199682410) — built for Kiwify.
INSERT INTO public.kiwify_event_mappings (product_id, trigger, target_pipeline_id, target_stage_id) VALUES
  (NULL, 'pix_gerado',            'f8aae630-649e-49c0-93c6-bd8199682410', '5a6e502b-25c0-4daa-a491-97643d855718'), -- Checkout Iniciado
  (NULL, 'boleto_gerado',         'f8aae630-649e-49c0-93c6-bd8199682410', '5a6e502b-25c0-4daa-a491-97643d855718'), -- Checkout Iniciado
  (NULL, 'carrinho_abandonado',   'f8aae630-649e-49c0-93c6-bd8199682410', '386f4f27-cb8d-449e-ba74-0a1f8ee583bb'), -- Carrinho Abandonado
  (NULL, 'compra_recusada',       'f8aae630-649e-49c0-93c6-bd8199682410', '3dcd860b-982d-4795-b2fb-4efd13f1d91a'), -- Pagamento Recusado
  (NULL, 'compra_aprovada',       'f8aae630-649e-49c0-93c6-bd8199682410', 'eb52d18c-6e6b-4d57-9e41-348a03f05d2a'), -- Pagamento Aprovado
  (NULL, 'compra_reembolsada',    'f8aae630-649e-49c0-93c6-bd8199682410', '3130aa19-7d22-4820-b372-d59d1a9a01ec'), -- Reembolsado (nova)
  (NULL, 'chargeback',            'f8aae630-649e-49c0-93c6-bd8199682410', '812c33ce-a788-4d6a-b20a-cc1a90027d37'), -- Chargeback (nova)
  (NULL, 'subscription_canceled', 'f8aae630-649e-49c0-93c6-bd8199682410', '485dfe05-ed94-445c-99b3-36ed424918fb'), -- Assinatura Cancelada (nova)
  (NULL, 'subscription_late',     'f8aae630-649e-49c0-93c6-bd8199682410', '1a559fcf-8348-4e10-944c-f7034711cdde'), -- Inadimplente (nova)
  (NULL, 'subscription_renewed',  'f8aae630-649e-49c0-93c6-bd8199682410', '17d7db07-89d2-442d-8082-b6c986d53618'); -- Em Andamento (existente)

-- ── 10. Seed kiwify_message_automations (4 flows, product_id NULL) ────────────
-- template_id null until real WhatsApp templates are assigned (KFY-1.5 config).
-- delay_minutes and cancel_on_triggers per architecture §3.4.
INSERT INTO public.kiwify_message_automations (product_id, trigger, steps, cancel_on_triggers) VALUES
  (NULL, 'pix_gerado',
    '[{"delay_minutes":0,"template_id":null,"variables":{}},
      {"delay_minutes":30,"template_id":null,"variables":{}},
      {"delay_minutes":120,"template_id":null,"variables":{}},
      {"delay_minutes":1440,"template_id":null,"variables":{}}]'::jsonb,
    ARRAY['compra_aprovada']),
  (NULL, 'carrinho_abandonado',
    '[{"delay_minutes":15,"template_id":null,"variables":{}},
      {"delay_minutes":180,"template_id":null,"variables":{}},
      {"delay_minutes":1440,"template_id":null,"variables":{}}]'::jsonb,
    ARRAY['compra_aprovada','pix_gerado','boleto_gerado']),
  (NULL, 'compra_aprovada',
    '[{"delay_minutes":0,"template_id":null,"variables":{}}]'::jsonb,
    ARRAY[]::text[]),
  (NULL, 'subscription_late',
    '[{"delay_minutes":0,"template_id":null,"variables":{}},
      {"delay_minutes":4320,"template_id":null,"variables":{}}]'::jsonb,
    ARRAY['subscription_renewed']);

COMMIT;
