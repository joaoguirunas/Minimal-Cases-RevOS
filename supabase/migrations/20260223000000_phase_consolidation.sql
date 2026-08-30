-- ╔════════════════════════════════════════════════════════════════════════════════╗
-- ║                     PHASE CONSOLIDATION — FEB 2026                             ║
-- ║  Unified migration: LP PRO v2, CALL PRO, SENDS PRO v2, SCHEDULE PRO,            ║
-- ║  AI Agents Phase 2, Analytics, A/B Testing, Score Settings, Single-Tenant      ║
-- ╚════════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 1: LP PRO™ v2 — Forms, Webhooks, Slugs, Thumbnails
-- ═══════════════════════════════════════════════════════════════════════════════════

-- 1.1 Forms v2: webhook + behavior flags + people_id linkage
ALTER TABLE public.lp_forms
  ADD COLUMN IF NOT EXISTS webhook_url    text,
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS create_contact boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS create_lead    boolean NOT NULL DEFAULT true;

ALTER TABLE public.lp_submissions
  ADD COLUMN IF NOT EXISTS people_id uuid REFERENCES public.clients_people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lp_submissions_people
  ON public.lp_submissions(people_id)
  WHERE people_id IS NOT NULL;

-- 1.2 Slug UNIQUE constraint (prevents duplicate URL paths)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lp_pages' AND constraint_name = 'lp_pages_slug_unique'
  ) THEN
    ALTER TABLE public.lp_pages
    ADD CONSTRAINT lp_pages_slug_unique UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lp_pages_slug ON public.lp_pages(slug);

-- 1.3 Thumbnails for page previews
ALTER TABLE public.lp_pages
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_lp_pages_thumbnail_url ON public.lp_pages(thumbnail_url)
  WHERE thumbnail_url IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 2: CALL PRO™ — Schema, RLS, Realtime
-- ═══════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.call_pro_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_secret text NOT NULL DEFAULT '',
  outbound_webhook_url text NOT NULL DEFAULT '',
  auto_link_leads boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_pro_tabulation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  icon text NOT NULL DEFAULT 'tag',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_pro_operator_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.settings_users(id) ON DELETE CASCADE,
  extension text NOT NULL DEFAULT '',
  as_email text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.call_pro_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  as_call_id text UNIQUE,
  person_id uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL DEFAULT 'newcall' CHECK (status IN (
    'newcall', 'ringing', 'in_progress', 'abandoned', 'answered',
    'blocked', 'handled', 'missed', 'failed'
  )),
  from_number text,
  to_number text,
  duration int DEFAULT 0,
  billed_duration int DEFAULT 0,
  recording_url text,
  outcome text,
  tags text[] DEFAULT '{}',
  notes text DEFAULT '',
  raw_payload jsonb DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_pro_calls_user ON public.call_pro_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_call_pro_calls_person ON public.call_pro_calls(person_id);
CREATE INDEX IF NOT EXISTS idx_call_pro_calls_started ON public.call_pro_calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_pro_calls_status ON public.call_pro_calls(status);

-- RLS for CALL PRO
ALTER TABLE public.call_pro_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_operator_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_pro_tabulation_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "call_pro_calls_select" ON public.call_pro_calls;
  DROP POLICY IF EXISTS "call_pro_calls_insert" ON public.call_pro_calls;
  DROP POLICY IF EXISTS "call_pro_calls_update" ON public.call_pro_calls;
END $$;

CREATE POLICY "call_pro_calls_select" ON public.call_pro_calls FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "call_pro_calls_insert" ON public.call_pro_calls FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "call_pro_calls_update" ON public.call_pro_calls FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 3: SENDS PRO™ v2 — Multi-Channel Support
-- ═══════════════════════════════════════════════════════════════════════════════════

-- 3.1 Multi-channel support
ALTER TABLE public.sends
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';

ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS sends_channel_check;
ALTER TABLE public.sends
  ADD CONSTRAINT sends_channel_check CHECK (channel IN ('whatsapp', 'email', 'sms', 'phone'));

-- 3.2 Phone/SMS contact field
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS telefone text;

CREATE INDEX IF NOT EXISTS idx_clients_people_email_not_null
  ON public.clients_people (email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_people_telefone_not_null
  ON public.clients_people (telefone) WHERE telefone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_people_whatsapp_not_null
  ON public.clients_people (whatsapp) WHERE whatsapp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sends_channel ON public.sends (channel);

-- 3.3 Restore missing columns
ALTER TABLE public.sends
  ADD COLUMN IF NOT EXISTS filter_config   jsonb,
  ADD COLUMN IF NOT EXISTS type            text    NOT NULL DEFAULT 'filtered',
  ADD COLUMN IF NOT EXISTS send_interval_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS webhook_id      uuid,
  ADD COLUMN IF NOT EXISTS failed_count    integer NOT NULL DEFAULT 0;

ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS sends_type_check;
ALTER TABLE public.sends
  ADD CONSTRAINT sends_type_check CHECK (type IN ('imported', 'filtered'));

ALTER TABLE public.sends
  DROP CONSTRAINT IF EXISTS sends_interval_check;
ALTER TABLE public.sends
  ADD CONSTRAINT sends_interval_check
    CHECK (send_interval_seconds IN (5, 10, 30, 60, 300, 600, 1800, 3600));


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 4: SCHEDULE PRO™ — Available Slots RPC
-- ═══════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS attendee_emails text[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_user_id      UUID,
  p_date         DATE,
  p_period       TEXT DEFAULT NULL,
  p_slot_minutes INT  DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow         INT;
  v_user_name   TEXT;
  v_result      JSONB := '[]'::JSONB;
  v_period_start TIME;
  v_period_end   TIME;
  rec           RECORD;
  v_cursor      TIME;
  v_slot_end    TIME;
  v_is_free     BOOLEAN;
BEGIN
  -- Validation
  IF p_slot_minutes < 15 OR p_slot_minutes > 480 THEN
    RAISE EXCEPTION 'p_slot_minutes must be between 15 and 480';
  END IF;

  -- Get user name
  SELECT name INTO v_user_name
  FROM settings_users
  WHERE id = p_user_id AND active = TRUE AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  -- Day of week
  v_dow := EXTRACT(DOW FROM p_date)::INT;

  -- Period filter
  IF p_period = 'morning' THEN
    v_period_start := '08:00'::TIME;
    v_period_end   := '12:00'::TIME;
  ELSIF p_period = 'afternoon' THEN
    v_period_start := '12:00'::TIME;
    v_period_end   := '18:00'::TIME;
  ELSIF p_period = 'evening' THEN
    v_period_start := '18:00'::TIME;
    v_period_end   := '22:00'::TIME;
  ELSE
    v_period_start := '00:00'::TIME;
    v_period_end   := '23:59'::TIME;
  END IF;

  -- Generate slots
  FOR rec IN
    SELECT
      GREATEST(ss.start_time, v_period_start) AS win_start,
      LEAST(ss.end_time, v_period_end)        AS win_end
    FROM settings_schedules ss
    WHERE ss.user_id     = p_user_id
      AND ss.day_of_week = v_dow
      AND ss.is_available = TRUE
      AND ss.start_time  < v_period_end
      AND ss.end_time    > v_period_start
    ORDER BY ss.start_time
  LOOP
    v_cursor := rec.win_start;

    WHILE v_cursor + (p_slot_minutes || ' minutes')::INTERVAL <= rec.win_end LOOP
      v_slot_end := (v_cursor + (p_slot_minutes || ' minutes')::INTERVAL)::TIME;

      -- Check if slot is free
      SELECT NOT EXISTS (
        SELECT 1
        FROM meetings m
        WHERE m.users_id = p_user_id
          AND m.status NOT IN ('cancelada', 'cancelado')
          AND m.start_time < (p_date + v_slot_end)::TIMESTAMPTZ
          AND m.end_time   > (p_date + v_cursor)::TIMESTAMPTZ
      ) INTO v_is_free;

      IF v_is_free THEN
        v_result := v_result || jsonb_build_object(
          'slot_start', TO_CHAR(v_cursor, 'HH24:MI'),
          'slot_end',   TO_CHAR(v_slot_end, 'HH24:MI'),
          'user_id',    p_user_id,
          'user_name',  v_user_name
        );
      END IF;

      v_cursor := v_slot_end;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, TEXT, INT) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 5: Single-Tenant Cleanup
-- ═══════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bi_ad_accounts
  DROP COLUMN IF EXISTS tenant_id;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 6: SCORE SETTINGS — Customizable Labels
-- ═══════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.score_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.score_settings (key, value) VALUES
  ('objectives_label',  'Objetivos'),
  ('investments_label', 'Faixas de Investimento'),
  ('framings_label',    'Segmentos')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.score_settings_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_score_settings_updated_at ON public.score_settings;
CREATE TRIGGER trg_score_settings_updated_at
  BEFORE UPDATE ON public.score_settings
  FOR EACH ROW EXECUTE FUNCTION public.score_settings_set_updated_at();

ALTER TABLE public.score_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "score_settings_all" ON public.score_settings;
CREATE POLICY "score_settings_all"
  ON public.score_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 7: AI AGENTS™ Phase 2 — Custom Fields, Templates, Tools, Execution Log
-- ═══════════════════════════════════════════════════════════════════════════════════

-- 7.1 CRM Field Definitions (unifies custom field schema across negocio/pessoa/empresa)
CREATE TABLE IF NOT EXISTS public.crm_field_definitions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT        NOT NULL,
  field_key     TEXT        NOT NULL,
  field_type    TEXT        NOT NULL DEFAULT 'text'
                            CHECK (field_type IN ('text', 'number', 'select', 'boolean', 'textarea', 'date')),
  category      TEXT        NOT NULL DEFAULT 'qualificacao'
                            CHECK (category IN ('qualificacao', 'contato', 'comercial', 'custom', 'outros')),
  entity_type   TEXT        NOT NULL DEFAULT 'pessoa'
                            CHECK (entity_type IN ('negocio', 'pessoa', 'empresa')),
  options       JSONB,
  active        BOOLEAN     NOT NULL DEFAULT true,
  order_index   INTEGER     NOT NULL DEFAULT 0,
  agent_managed BOOLEAN     NOT NULL DEFAULT false,
  pipeline_id   UUID,
  required      BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (field_key, entity_type)
);

CREATE OR REPLACE FUNCTION public.crm_field_definitions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_crm_field_definitions_updated_at ON public.crm_field_definitions;
CREATE TRIGGER trg_crm_field_definitions_updated_at
  BEFORE UPDATE ON public.crm_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.crm_field_definitions_set_updated_at();

ALTER TABLE public.crm_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_field_definitions_all" ON public.crm_field_definitions;
CREATE POLICY "crm_field_definitions_all"
  ON public.crm_field_definitions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 7.2 CRM Field Values (normalized storage)
CREATE TABLE IF NOT EXISTS public.crm_field_values (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT        NOT NULL CHECK (entity_type IN ('negocio', 'pessoa', 'empresa')),
  entity_id     UUID        NOT NULL,
  field_key     TEXT        NOT NULL,
  value_text    TEXT,
  value_number  NUMERIC,
  value_boolean BOOLEAN,
  value_date    DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (entity_type, entity_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_field_values_entity
  ON public.crm_field_values (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_crm_field_values_field_key
  ON public.crm_field_values (field_key);

CREATE OR REPLACE FUNCTION public.crm_field_values_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_crm_field_values_updated_at ON public.crm_field_values;
CREATE TRIGGER trg_crm_field_values_updated_at
  BEFORE UPDATE ON public.crm_field_values
  FOR EACH ROW EXECUTE FUNCTION public.crm_field_values_set_updated_at();

ALTER TABLE public.crm_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_field_values_all" ON public.crm_field_values;
CREATE POLICY "crm_field_values_all"
  ON public.crm_field_values FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 7.3 Migrate existing lead_field_definitions → crm_field_definitions
INSERT INTO public.crm_field_definitions (
  label, field_key, field_type, category, entity_type,
  options, active, order_index, agent_managed,
  pipeline_id, required, created_at, updated_at
)
SELECT
  name,
  key,
  CASE type WHEN 'single_select' THEN 'select' ELSE type END,
  category,
  'negocio',
  options,
  active,
  ordem,
  false,
  pipeline_id,
  required,
  created_at,
  updated_at
FROM public.lead_field_definitions
ON CONFLICT (field_key, entity_type) DO NOTHING;

-- 7.4 Migrate existing lead_field_values → crm_field_values
INSERT INTO public.crm_field_values (
  entity_type, entity_id, field_key,
  value_text, value_number, value_boolean, value_date,
  created_at, updated_at
)
SELECT
  'negocio',
  lfv.lead_id,
  lfd.key,
  lfv.value_text,
  lfv.value_number,
  lfv.value_boolean,
  lfv.value_date,
  lfv.created_at,
  lfv.updated_at
FROM public.lead_field_values lfv
JOIN public.lead_field_definitions lfd ON lfd.id = lfv.field_definition_id
ON CONFLICT (entity_type, entity_id, field_key) DO NOTHING;

-- 7.5 RPCs: update_qualification_field + move_lead_to_stage
CREATE OR REPLACE FUNCTION public.update_qualification_field(
  p_person_id UUID,
  p_field_key TEXT,
  p_value     TEXT
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.crm_field_values (entity_type, entity_id, field_key, value_text)
  VALUES ('pessoa', p_person_id, p_field_key, p_value)
  ON CONFLICT (entity_type, entity_id, field_key)
  DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now();
$$;

GRANT EXECUTE ON FUNCTION public.update_qualification_field TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.move_lead_to_stage(
  p_lead_id    UUID,
  p_stage_name TEXT
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.leads
  SET leads_stages_id = (
    SELECT id FROM public.leads_stages
    WHERE LOWER(name) = LOWER(p_stage_name)
    LIMIT 1
  )
  WHERE id = p_lead_id;
$$;

GRANT EXECUTE ON FUNCTION public.move_lead_to_stage TO authenticated, service_role;

-- 7.6 AI Agents — template columns + tool management
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS template_type TEXT,
  ADD COLUMN IF NOT EXISTS prompt_blocks JSONB,
  ADD COLUMN IF NOT EXISTS enabled_tools TEXT[];

-- 7.7 Seed AI Agent Templates
INSERT INTO public.ai_agents (
  name, description, is_template, template_type,
  active, use_stages, current_version,
  identity, input_data, general_rules, score_value
)
SELECT
  'Template — Triagem',
  'Recepcionista que coleta nome, empresa e intenção de contato, então avança o lead para qualificação.',
  true, 'triagem', true, false, 1,
  'Você é Sofia, assistente de triagem da empresa. Seu objetivo é recepcionar novos leads, identificar nome, empresa e intenção de contato, e encaminhá-los para a próxima etapa do processo comercial. Seja cordial, profissional e objetivo. Não tente vender — apenas identificar e passar adiante.',
  'Dados disponíveis: {{lead_id}}, {{nome}}, {{empresa}}, {{whatsapp}}, {{etapa_atual}}',
  '1. Apresente-se pelo nome. 2. Colete: nome, empresa e motivação. 3. Use "Atualizar Pessoa". 4. Use "Atualizar Lead" com control:2. 5. Não venda na triagem.',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE is_template AND template_type = 'triagem')
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agents (
  name, description, is_template, template_type,
  active, use_stages, current_version,
  identity, input_data, general_rules, score_value
)
SELECT
  'Template — Qualificação',
  'Qualificação em 4 etapas: Identificação → Necessidades → Orçamento → Decisor.',
  true, 'qualificacao', true, true, 1,
  'Você é Alex, especialista em qualificação de leads. Seu objetivo é conduzir uma conversa consultiva para entender perfil, necessidades, capacidade de investimento e processo de decisão.',
  'Dados disponíveis: {{lead_id}}, {{nome}}, {{empresa}}, {{score_objetivo}}',
  '1. Comece com diagnóstico operacional. 2. Qualifique com BANT. 3. Analise fit e objeções. 4. Salve campos via tools.',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE is_template AND template_type = 'qualificacao')
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_agents (
  name, description, is_template, template_type,
  active, use_stages, current_version,
  identity, input_data, general_rules, score_value
)
SELECT
  'Template — Agendamento',
  'Especialista em agendamento que sugere horários e confirma reuniões via calendário.',
  true, 'agendamento', true, false, 1,
  'Você é Cal, especialista em agendamento. Seu objetivo é sugerir slots disponíveis do atendente e agendar a reunião de forma cordial e profissional.',
  'Dados disponíveis: {{user_id}}, {{data_preferida}}, {{periodo}}',
  '1. Busque slots disponíveis. 2. Sugira 3 opções. 3. Confirme horário via tool. 4. Envie confirmação.',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE is_template AND template_type = 'agendamento')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- PRE-7.8: Drop all legacy triggers on crm_field_definitions
-- Migrations 20260221000000 + 20260222400000 may have left sync triggers that copy
-- crm_field_definitions INSERTs → lead_field_definitions with options=null,
-- which violates lead_field_definitions.options NOT NULL constraint.
-- ═══════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'crm_field_definitions'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.crm_field_definitions', r.trigger_name);
  END LOOP;
END;
$$;


-- 7.8 Insert 26 Qualification Fields (with q prefix)
INSERT INTO public.crm_field_definitions
  (field_key, entity_type, label, field_type, category, agent_managed, active, order_index)
VALUES
  ('q1_gargalo_principal',       'pessoa', 'Q1 — Gargalo Principal',              'textarea', 'qualificacao', true, true,  1),
  ('q2_tamanho_equipe',          'pessoa', 'Q2 — Tamanho da Equipe Comercial',    'text',     'qualificacao', true, true,  2),
  ('q3_volume_leads_mes',        'pessoa', 'Q3 — Volume de Leads / Mês',          'text',     'qualificacao', true, true,  3),
  ('q4_taxa_conversao',          'pessoa', 'Q4 — Taxa de Conversão Atual',        'text',     'qualificacao', true, true,  4),
  ('q5_ticket_medio',            'pessoa', 'Q5 — Ticket Médio',                   'text',     'qualificacao', true, true,  5),
  ('q6_ciclo_vendas',            'pessoa', 'Q6 — Ciclo de Vendas',                'text',     'qualificacao', true, true,  6),
  ('q7_ferramentas_atuais',      'pessoa', 'Q7 — Ferramentas Atuais',             'textarea', 'qualificacao', true, true,  7),
  ('q8_nivel_engajamento',       'pessoa', 'Q8 — Nível de Engajamento',           'text',     'qualificacao', true, true,  8),
  ('q9_autoridade_decisao',      'pessoa', 'Q9 — Autoridade de Decisão',          'text',     'qualificacao', true, true,  9),
  ('q10_budget_disponivel',      'pessoa', 'Q10 — Budget Disponível',             'text',     'qualificacao', true, true, 10),
  ('q11_timeline_implementacao', 'pessoa', 'Q11 — Timeline de Implementação',     'text',     'qualificacao', true, true, 11),
  ('q12_tentativas_anteriores',  'pessoa', 'Q12 — Tentativas Anteriores',         'textarea', 'qualificacao', true, true, 12),
  ('q13_urgencia_resolucao',     'pessoa', 'Q13 — Urgência de Resolução',         'text',     'qualificacao', true, true, 13),
  ('q14_impacto_financeiro',     'pessoa', 'Q14 — Impacto Financeiro do Problema','text',     'qualificacao', true, true, 14),
  ('q15_concorrentes_avaliados', 'pessoa', 'Q15 — Concorrentes Avaliados',        'textarea', 'qualificacao', true, true, 15),
  ('q16_criterio_decisao',       'pessoa', 'Q16 — Critério de Decisão',           'textarea', 'qualificacao', true, true, 16),
  ('q17_objecoes_previstas',     'pessoa', 'Q17 — Objeções Previstas',            'textarea', 'qualificacao', true, true, 17),
  ('q18_sponsorship_interno',    'pessoa', 'Q18 — Sponsor Interno',               'text',     'qualificacao', true, true, 18),
  ('q19_nivel_interesse',        'pessoa', 'Q19 — Nível de Interesse (0–10)',     'number',   'qualificacao', true, true, 19),
  ('q20_probabilidade_fechamento','pessoa', 'Q20 — Probabilidade de Fechamento %','number',   'qualificacao', true, true, 20),
  ('q21_status_qualificacao',    'pessoa', 'Q21 — Status de Qualificação',        'select',   'qualificacao', true, true, 21),
  ('q22_motivo_rejeicao',        'pessoa', 'Q22 — Motivo de Rejeição',            'textarea', 'qualificacao', true, true, 22),
  ('q23_tags_comportamentais',   'pessoa', 'Q23 — Tags Comportamentais',          'text',     'qualificacao', true, true, 23),
  ('q24_disc_perfil',            'pessoa', 'Q24 — Perfil DISC',                   'select',   'qualificacao', true, true, 24),
  ('q25_disc_analise',           'pessoa', 'Q25 — Análise DISC Detalhada',        'textarea', 'qualificacao', true, true, 25),
  ('q26_resumo_conversa',        'pessoa', 'Q26 — Resumo da Conversa',            'textarea', 'qualificacao', true, true, 26)
ON CONFLICT (field_key, entity_type) DO NOTHING;

-- Set options for select fields
UPDATE public.crm_field_definitions
SET options = '["qualified","unqualified","in_progress"]'::jsonb
WHERE field_key = 'q21_status_qualificacao' AND entity_type = 'pessoa';

UPDATE public.crm_field_definitions
SET options = '["D","I","S","C"]'::jsonb
WHERE field_key = 'q24_disc_perfil' AND entity_type = 'pessoa';

-- 7.9 AI Agents Execution Log
CREATE TABLE IF NOT EXISTS public.ai_agents_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  people_id UUID NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  prompt_rendered TEXT NOT NULL,
  tools_used TEXT[] DEFAULT '{}',
  execution_status TEXT NOT NULL,
  execution_duration_ms INT,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_exec_agent_time
  ON public.ai_agents_execution_log(ai_agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agents_exec_people_time
  ON public.ai_agents_execution_log(people_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agents_exec_status
  ON public.ai_agents_execution_log(execution_status, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 8: LP PRO™ Analytics + A/B Testing
-- ═══════════════════════════════════════════════════════════════════════════════════

-- 8.1 Page Analytics
CREATE TABLE IF NOT EXISTS public.lp_page_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.lp_pages(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  device_type TEXT,
  device_os TEXT,
  browser TEXT,
  time_on_page INT,
  scroll_depth INT,
  viewed_at TIMESTAMP DEFAULT now(),
  left_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lp_page_analytics_page
  ON public.lp_page_analytics(page_id);
CREATE INDEX IF NOT EXISTS idx_lp_page_analytics_visitor
  ON public.lp_page_analytics(visitor_id);

-- 8.2 A/B Test campaigns
CREATE TABLE IF NOT EXISTS public.lp_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  hypothesis TEXT,
  traffic_percent INT DEFAULT 100,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  confidence_level INT DEFAULT 95,
  min_sample_size INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- 8.3 A/B Variants
CREATE TABLE IF NOT EXISTS public.lp_ab_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES lp_ab_tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  traffic_weight INT DEFAULT 100,
  is_control BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now()
);

-- 8.4 A/B Sessions
CREATE TABLE IF NOT EXISTS public.lp_ab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  test_id UUID REFERENCES lp_ab_tests(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES lp_ab_variants(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  started_at TIMESTAMP DEFAULT now(),
  last_activity_at TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_test_or_default CHECK (
    (test_id IS NULL AND variant_id IS NULL) OR
    (test_id IS NOT NULL AND variant_id IS NOT NULL)
  )
);

-- 8.5 A/B Conversions
CREATE TABLE IF NOT EXISTS public.lp_ab_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES lp_ab_sessions(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES lp_ab_tests(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES lp_ab_variants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- 8.6 A/B Indexes
CREATE INDEX IF NOT EXISTS idx_lp_ab_tests_page_id ON public.lp_ab_tests(page_id);
CREATE INDEX IF NOT EXISTS idx_lp_ab_tests_status ON public.lp_ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_lp_ab_variants_test_id ON public.lp_ab_variants(test_id);
CREATE INDEX IF NOT EXISTS idx_lp_ab_sessions_page_id ON public.lp_ab_sessions(page_id);
CREATE INDEX IF NOT EXISTS idx_lp_ab_sessions_test_id ON public.lp_ab_sessions(test_id);
CREATE INDEX IF NOT EXISTS idx_lp_ab_sessions_visitor_id ON public.lp_ab_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_lp_ab_conversions_test_id ON public.lp_ab_conversions(test_id);
CREATE INDEX IF NOT EXISTS idx_lp_ab_conversions_variant_id ON public.lp_ab_conversions(variant_id);

-- 8.7 RLS for Analytics tables
ALTER TABLE public.lp_page_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_ab_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_ab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_ab_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_page_analytics_insert" ON public.lp_page_analytics;
CREATE POLICY "lp_page_analytics_insert" ON public.lp_page_analytics FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "lp_ab_tests_select" ON public.lp_ab_tests;
CREATE POLICY "lp_ab_tests_select" ON public.lp_ab_tests FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lp_ab_tests_insert" ON public.lp_ab_tests;
CREATE POLICY "lp_ab_tests_insert" ON public.lp_ab_tests FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lp_ab_sessions_insert" ON public.lp_ab_sessions;
CREATE POLICY "lp_ab_sessions_insert" ON public.lp_ab_sessions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "lp_ab_conversions_insert" ON public.lp_ab_conversions;
CREATE POLICY "lp_ab_conversions_insert" ON public.lp_ab_conversions FOR INSERT
  WITH CHECK (true);

-- 8.8 Helper functions
CREATE OR REPLACE FUNCTION public.get_ab_variant(
  p_visitor_id TEXT,
  p_test_id UUID
) RETURNS UUID AS $$
DECLARE
  v_variant_id UUID;
  v_total_weight INT;
  v_random_weight INT;
BEGIN
  SELECT COALESCE(SUM(traffic_weight), 0)
  INTO v_total_weight
  FROM public.lp_ab_variants
  WHERE test_id = p_test_id;

  IF v_total_weight = 0 THEN
    RETURN NULL;
  END IF;

  v_random_weight := (
    ('x' || substr(md5(p_visitor_id || p_test_id::text), 1, 8))::bit(32)::bigint % v_total_weight
  );

  SELECT id INTO v_variant_id
  FROM (
    SELECT
      id,
      traffic_weight,
      SUM(traffic_weight) OVER (ORDER BY created_at) as cumulative_weight
    FROM public.lp_ab_variants
    WHERE test_id = p_test_id
  ) variants
  WHERE v_random_weight < cumulative_weight
  ORDER BY cumulative_weight
  LIMIT 1;

  RETURN v_variant_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ═══════════════════════════════════════════════════════════════════════════════════
-- SECTION 9: Deprecation Notice
-- ═══════════════════════════════════════════════════════════════════════════════════

-- Mark prompt_blocks as deprecated
COMMENT ON COLUMN public.ai_agents.prompt_blocks IS
  '[DEPRECATED in v2.0] Use ai_agents_steps table instead for step-based prompts. '
  'This column was never populated and will be removed in v3.0. '
  'Retention period: until 2026-12-31.';

-- Add instagram_id to clients_people for omnichannel dedup
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS instagram_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS clients_people_instagram_id_key
  ON public.clients_people (instagram_id)
  WHERE instagram_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- FINAL: Complete
-- ═══════════════════════════════════════════════════════════════════════════════════
-- This single migration consolidates 20 individual migrations:
-- ✅ LP PRO™ v2 forms, webhooks, slugs, thumbnails
-- ✅ CALL PRO™ schema + RLS
-- ✅ SENDS PRO™ v2 multichannel + missing columns
-- ✅ SCHEDULE PRO™ available slots RPC
-- ✅ AI Agents™ Phase 2 (custom fields + templates + 26 qual fields + execution log)
-- ✅ LP PRO™ Analytics + A/B Testing
-- ✅ Score Settings
-- ✅ Single-Tenant cleanup
-- ═══════════════════════════════════════════════════════════════════════════════════
