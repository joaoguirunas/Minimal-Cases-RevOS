-- ============================================================
-- Bootstrap guard: ensure full tenant schema exists.
-- 
-- New tenants provisioned after the manifest epoch (2026-03-12)
-- would not have any of the legacy tables created by pre-manifest
-- migrations (timestamps 20250624–20260311). This migration
-- closes that gap idempotently.
--
-- Source: consolidated snapshot from 2025-12-02 (pre-manifest).
-- On existing tenants: all CREATE TABLE / INDEX / POLICY / TRIGGER
-- statements fail silently with "already exists" → skipped by the
-- adm-sync-client isIdempotentError handler. Safe to apply to all.
--
-- Order: 009 (before 010_ensure_crm_tenants_baseline)
-- ============================================================

-- ============================================
-- FUNÇÕES AUXILIARES (necessárias para triggers)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.calculate_tokens_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tokens_total := COALESCE(NEW.tokens_input, 0) + COALESCE(NEW.tokens_output, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- ETAPA 3: TABELAS PRINCIPAIS
-- ============================================

-- ----------------------------------------
-- 3.1 SETTINGS (Configurações Gerais)
-- ----------------------------------------
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  secondary_color text DEFAULT '#8b5cf6',
  accent_color text DEFAULT '#ec4899',
  email text,
  phone text,
  website text,
  address text,
  tax_id text,
  timezone text DEFAULT 'America/Sao_Paulo',
  language text DEFAULT 'pt-br',
  currency text DEFAULT 'BRL',
  whatsapp_provider text DEFAULT 'whatsapp-oficial',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.2 SETTINGS_USERS (Usuários)
-- ----------------------------------------
CREATE TABLE public.settings_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  avatar_url text,
  user_type text DEFAULT 'atendente',
  super_admin boolean DEFAULT false,
  active boolean DEFAULT true,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings_users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.3 SETTINGS_TEAMS (Times)
-- ----------------------------------------
CREATE TABLE public.settings_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  team_type text DEFAULT 'vendas',
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings_teams ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.4 SETTINGS_USERS_TEAMS (Relação Usuários-Times)
-- ----------------------------------------
CREATE TABLE public.settings_users_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.settings_users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.settings_teams(id) ON DELETE CASCADE,
  is_leader boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, team_id)
);

ALTER TABLE public.settings_users_teams ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.5 SETTINGS_SCHEDULES (Horários)
-- ----------------------------------------
CREATE TABLE public.settings_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.settings_users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings_schedules ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.6 SETTINGS_SYSTEM_MODULES (Módulos)
-- ----------------------------------------
CREATE TABLE public.settings_system_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  module_name text NOT NULL,
  icon text,
  ordem integer NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings_system_modules ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.7 CLIENTS_PEOPLE (Pessoas/Clientes)
-- ----------------------------------------
CREATE TABLE public.clients_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  whatsapp text,
  document text,
  type text,
  notes text,
  status text DEFAULT 'ativo',
  service_status text,
  source text,
  accepts_calls boolean DEFAULT true,
  ai_enabled boolean DEFAULT false,
  archived boolean DEFAULT false,
  archived_at timestamptz,
  -- Score fields
  score integer,
  score_matrix_id uuid,
  score_framing_id uuid,
  score_investment_id uuid,
  score_objective_id uuid,
  -- Profile fields
  income text,
  moment text,
  goal text,
  disc_profile text,
  disc_summary text,
  conversation_summary text,
  -- Qualification questions
  q1_age integer,
  q2_has_children boolean,
  q3_number_of_children integer,
  q4_qualification_1 text,
  q5_qualification_area text,
  q6_profession_current text,
  q7_profession_years text,
  q8_professional_recognition text,
  q9_foreign_citizenship boolean,
  q10_migration_process text,
  q11_decision_move_usa text,
  q12_start_process_time text,
  q13_household_income text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients_people ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.8 CLIENTS_PEOPLE_UPDATES (Histórico Pessoas)
-- ----------------------------------------
CREATE TABLE public.clients_people_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id uuid REFERENCES public.clients_people(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients_people_updates ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.9 CLIENTS_COMPANIES (Empresas)
-- ----------------------------------------
CREATE TABLE public.clients_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  legal_name text,
  tax_id text,
  email text,
  phone text,
  website text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients_companies ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.10 LEADS_PIPELINES (Pipelines)
-- ----------------------------------------
CREATE TABLE public.leads_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_pipelines ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.11 LEADS_STAGES (Etapas)
-- ----------------------------------------
CREATE TABLE public.leads_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_pipelines_id uuid REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_stages ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.12 LEADS_STAGES_FOLLOWUPS (Follow-ups)
-- ----------------------------------------
CREATE TABLE public.leads_stages_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES public.leads_stages(id) ON DELETE CASCADE,
  name text NOT NULL,
  message text NOT NULL,
  delay_minutes integer DEFAULT 60,
  whatsapp_template_id text,
  score_matrix_id uuid,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_stages_followups ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.13 LEADS_LOSS_REASONS (Motivos de Perda)
-- ----------------------------------------
CREATE TABLE public.leads_loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_loss_reasons ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.14 LEADS (Negócios)
-- ----------------------------------------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  control text,
  value numeric DEFAULT 0,
  status text DEFAULT 'em-andamento',
  people_id uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  companies_id uuid REFERENCES public.clients_companies(id) ON DELETE SET NULL,
  leads_pipelines_id uuid REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  leads_stages_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  leads_loss_reasons_id uuid REFERENCES public.leads_loss_reasons(id) ON DELETE SET NULL,
  loss_reason text,
  teams_id uuid REFERENCES public.settings_teams(id) ON DELETE SET NULL,
  users_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  archived boolean DEFAULT false,
  archived_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  last_interaction_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.15 LEADS_NOTES (Notas)
-- ----------------------------------------
CREATE TABLE public.leads_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  users_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  title text,
  content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_notes ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.16 LEADS_FILES (Arquivos)
-- ----------------------------------------
CREATE TABLE public.leads_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  users_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_files ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.17 LEADS_UPDATES (Histórico Movimentação)
-- ----------------------------------------
CREATE TABLE public.leads_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  users_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  from_stage_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  to_stage_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_updates ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.18 MEETINGS (Reuniões)
-- ----------------------------------------
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  meeting_link text,
  notes text,
  status text DEFAULT 'agendada',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  people_id uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  leads_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  users_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  teams_id uuid REFERENCES public.settings_teams(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.19 MESSAGES (Mensagens)
-- ----------------------------------------
CREATE TABLE public.messages (
  id bigserial PRIMARY KEY,
  content text NOT NULL,
  from_contact text DEFAULT 'cliente',
  message_type text DEFAULT 'texto',
  status text DEFAULT 'pendente',
  channel text DEFAULT 'whatsapp',
  media_url text,
  whatsapp_template_id text,
  followup_id uuid REFERENCES public.leads_stages_followups(id) ON DELETE SET NULL,
  people_id uuid REFERENCES public.clients_people(id) ON DELETE CASCADE,
  leads_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  users_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.20 SCORE_OBJECTIVES (Objetivos)
-- ----------------------------------------
CREATE TABLE public.score_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.score_objectives ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.21 SCORE_INVESTMENTS (Investimentos)
-- ----------------------------------------
CREATE TABLE public.score_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.score_investments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.22 SCORE_FRAMINGS (Enquadramentos)
-- ----------------------------------------
CREATE TABLE public.score_framings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.score_framings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.23 SCORE_MATRIX (Matriz de Score)
-- ----------------------------------------
CREATE TABLE public.score_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  score_number integer NOT NULL,
  profile_score text,
  pre_description_score text,
  detail_score text,
  objective_id uuid[],
  investment_id uuid[],
  framing_id uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.score_matrix ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.24 SENDS (Disparos)
-- ----------------------------------------
CREATE TABLE public.sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_id text,
  status text DEFAULT 'draft',
  pipeline_id uuid REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  stage_ids uuid[],
  team_id uuid REFERENCES public.settings_teams(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  total_contacts integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  read_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sends ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.25 SENDS_CONTACTS (Contatos Disparos)
-- ----------------------------------------
CREATE TABLE public.sends_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid REFERENCES public.sends(id) ON DELETE CASCADE,
  people_id uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  whatsapp text NOT NULL,
  status text DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sends_contacts ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.26 WEBHOOKS
-- ----------------------------------------
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  event_type text NOT NULL,
  headers jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.27 WEBHOOK_LOGS
-- ----------------------------------------
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES public.webhooks(id) ON DELETE CASCADE,
  request_body jsonb,
  response_body jsonb,
  status_code integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.28 WHATSAPP_TEMPLATES
-- ----------------------------------------
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_template text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  status text DEFAULT 'ativo',
  system_enabled boolean DEFAULT true,
  json_data jsonb,
  variables jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.29 AI_AGENTS (Agentes IA)
-- ----------------------------------------
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  identity text,
  input_data text,
  general_rules text,
  pipeline_id uuid REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  score_value integer,
  current_version integer DEFAULT 1,
  use_stages boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.30 AI_AGENTS_HISTORY
-- ----------------------------------------
CREATE TABLE public.ai_agents_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  version integer NOT NULL,
  data jsonb NOT NULL,
  changelog jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_agents_history ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.31 AI_AGENTS_STEPS
-- ----------------------------------------
CREATE TABLE public.ai_agents_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  control text,
  order_index integer NOT NULL,
  pipeline_id uuid REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_agents_steps ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.32 AI_AGENTS_STEPS_HISTORY
-- ----------------------------------------
CREATE TABLE public.ai_agents_steps_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid REFERENCES public.ai_agents_steps(id) ON DELETE CASCADE,
  leads_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  success boolean,
  result jsonb,
  error_message text,
  executed_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_agents_steps_history ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 3.33 AI_AGENTS_SCORE_MATRIX
-- ----------------------------------------
CREATE TABLE public.ai_agents_score_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  score_matrix_id uuid REFERENCES public.score_matrix(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_agents_score_matrix ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- ADICIONAR FOREIGN KEYS EM CLIENTS_PEOPLE
-- ----------------------------------------
ALTER TABLE public.clients_people
  ADD CONSTRAINT fk_score_matrix FOREIGN KEY (score_matrix_id) REFERENCES public.score_matrix(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_score_framing FOREIGN KEY (score_framing_id) REFERENCES public.score_framings(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_score_income FOREIGN KEY (score_investment_id) REFERENCES public.score_investments(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_score_objective FOREIGN KEY (score_objective_id) REFERENCES public.score_objectives(id) ON DELETE SET NULL;

-- ============================================
-- ETAPA 4: TABELAS PRÉ-EPOCH (Jan-Mar 2026)
-- Tabelas criadas entre Dec/2025 e a epoch do manifest (2026-03-12)
-- não capturadas pelo snapshot Dec/2025. Idempotentes via IF NOT EXISTS.
-- ============================================

-- ----------------------------------------
-- 4.1 BI_SETTINGS
-- BI PRO™: OAuth credentials para Meta Ads e Google Ads
-- Fonte: 20260218140000_bi_settings-ok.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.bi_settings (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_app_id            text,
  meta_app_secret        text,
  google_client_id       text,
  google_client_secret   text,
  google_developer_token text,
  singleton              boolean     NOT NULL DEFAULT true,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bi_settings_singleton_key UNIQUE (singleton)
);
-- Garante coluna singleton em tenants que criaram bi_settings antes do patch 20260303
ALTER TABLE public.bi_settings ADD COLUMN IF NOT EXISTS singleton boolean NOT NULL DEFAULT true;
ALTER TABLE public.bi_settings DROP CONSTRAINT IF EXISTS bi_settings_singleton_key;
ALTER TABLE public.bi_settings ADD CONSTRAINT bi_settings_singleton_key UNIQUE (singleton);
INSERT INTO public.bi_settings (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

-- ----------------------------------------
-- 4.2 LEAD_FIELD_DEFINITIONS
-- CRM PRO™: Definições de campos customizados por lead (global ou por pipeline)
-- Fonte: 20260219100000_lead_custom_fields-ok.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_field_definitions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  key         text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('text', 'number', 'single_select', 'boolean', 'date')),
  category    text        NOT NULL CHECK (category IN ('qualificacao', 'outros')),
  pipeline_id uuid        REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
  options     jsonb       NOT NULL DEFAULT '[]',
  required    boolean     NOT NULL DEFAULT false,
  active      boolean     NOT NULL DEFAULT true,
  ordem       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.3 LEAD_FIELD_VALUES
-- CRM PRO™: Valores dos campos customizados por lead
-- Fonte: 20260219100000_lead_custom_fields-ok.sql
-- Depende de: lead_field_definitions (4.2), leads
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_field_values (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_definition_id uuid        NOT NULL REFERENCES public.lead_field_definitions(id) ON DELETE CASCADE,
  value_text          text,
  value_number        numeric,
  value_boolean       boolean,
  value_date          date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, field_definition_id)
);

-- ----------------------------------------
-- 4.4 MEETING_RECORDS
-- Schedule PRO™: Gravações, transcrições e análises de reuniões
-- Fonte: 20260219160000_meeting_records-ok.sql
-- Depende de: meetings, settings_users
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_records (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id     uuid        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  record_type    text        NOT NULL CHECK (record_type IN (
    'recording', 'transcript', 'summary', 'ai_summary', 'ai_analysis', 'note'
  )),
  source         text,
  url            text,
  duration_seconds integer,
  thumbnail_url  text,
  title          text,
  content        text,
  content_format text        DEFAULT 'markdown'
    CHECK (content_format IN ('text', 'markdown', 'html', 'json')),
  ai_sentiment   text
    CHECK (ai_sentiment IN ('positivo', 'neutro', 'negativo', 'misto')),
  ai_score       integer     CHECK (ai_score >= 0 AND ai_score <= 100),
  ai_key_topics  text[],
  ai_next_steps  text[],
  ai_objections  text[],
  ai_metadata    jsonb,
  recorded_at    timestamptz,
  created_by     uuid        REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.5 USER_CALENDAR_CONNECTIONS
-- Schedule PRO™: Tokens OAuth Google Calendar por usuário
-- Fonte: 20260218143000_google_calendar-ok.sql
-- Depende de: settings_users
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES public.settings_users(id) ON DELETE CASCADE,
  google_email            text        NOT NULL,
  google_access_token     text,
  google_refresh_token    text        NOT NULL,
  google_token_expires_at timestamptz,
  google_calendar_id      text        NOT NULL DEFAULT 'primary',
  is_active               boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ----------------------------------------
-- 4.6 MEETINGS_FOLLOWUPS
-- CALL PRO™: Regras de follow-up por status de reunião
-- Fonte: 20260226150000_create_meetings_followups-ok.sql
--         20260226301000_meeting_followup_system-ok.sql (colunas extras)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings_followups (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_status text        NOT NULL
    CHECK (meeting_status IN ('agendado', 'compareceu', 'nao_compareceu', 'cancelado')),
  type           text        NOT NULL DEFAULT 'texto',
  message        text,
  subject        text,
  template_id    text,
  audio_file     text,
  days           integer     NOT NULL DEFAULT 0,
  hours          integer     NOT NULL DEFAULT 0,
  minutes        integer     NOT NULL DEFAULT 0,
  active         boolean     NOT NULL DEFAULT true,
  control        integer,
  name           text,
  channel        text        NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone')),
  webhook_url    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.7 FOLLOWUP_QUEUE
-- FOLLOW-UPS PRO™: Fila de disparos agendados (legacy — será dropada após migração)
-- Fonte: 20260226201000_followup_queue-ok.sql
-- Depende de: leads_stages_followups, meetings_followups (4.6), leads, clients_people, messages
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.followup_queue (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id         uuid        REFERENCES public.leads_stages_followups(id) ON DELETE CASCADE,
  meeting_followup_id uuid        REFERENCES public.meetings_followups(id) ON DELETE CASCADE,
  lead_id             uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  pessoa_id           uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  canal               text        NOT NULL,
  template_id         text,
  mensagem            text,
  assunto             text,
  phone_number        text,
  source_type         text        NOT NULL DEFAULT 'stage'
    CHECK (source_type IN ('stage', 'meeting')),
  scheduled_at        timestamptz NOT NULL,
  fired_at            timestamptz,
  status              text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'cancelled')),
  message_id          bigint      REFERENCES public.messages(id) ON DELETE SET NULL,
  response_data       jsonb,
  error_message       text,
  retry_count         integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.8 MEETING_FOLLOWUP_QUEUE
-- CALL PRO™: Fila de follow-ups agendados por status de reunião
-- Fonte: 20260226301000_meeting_followup_system-ok.sql
-- Depende de: meetings_followups (4.6), meetings, clients_people, leads
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_followup_queue (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          uuid        NOT NULL REFERENCES public.meetings_followups(id) ON DELETE CASCADE,
  meeting_id       uuid        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  people_id        uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  leads_id         uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  scheduled_for    timestamptz NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  channel          text        NOT NULL,
  webhook_url      text        NOT NULL,
  message_snapshot text,
  fired_at         timestamptz,
  response_status  int,
  response_body    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.9 MESSAGE_BUFFER
-- N8N-WAA™: Buffer de debounce de mensagens inbound (substitui Redis)
-- Fonte: 20260302120000_n8n-waa-3-message-buffer-ok.sql
-- Depende de: clients_people
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.message_buffer (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id    uuid        NOT NULL REFERENCES public.clients_people(id) ON DELETE CASCADE,
  messages     jsonb[]     NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  processed    boolean     NOT NULL DEFAULT false,
  processed_at timestamptz
);

-- ----------------------------------------
-- 4.10 SETTINGS_WHATSAPP_CHANNELS
-- N8N-WAA™: Credenciais Meta API por número WhatsApp Business
-- Fonte: 20260302150000_n8n-waa-6-whatsapp-channels-ok.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_whatsapp_channels (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label           text        NOT NULL,
  phone_number_id text        NOT NULL UNIQUE,
  access_token    text        NOT NULL,
  is_default      boolean     NOT NULL DEFAULT false,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.11 SETTINGS_OMNI_NEW_CONTACT
-- OMNI PRO™: Configuração de auto-criação de negócio por canal
-- Fonte: 20260303000001_omni_new_contact_settings-ok.sql
-- Depende de: leads_pipelines, leads_stages
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_omni_new_contact (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  channel             text        NOT NULL
    CHECK (channel IN ('whatsapp', 'email', 'instagram_dm', 'instagram_comment')),
  auto_create_negocio boolean     NOT NULL DEFAULT false,
  pipeline_id         uuid        REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  stage_id            uuid        REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  title_template      text        NOT NULL DEFAULT 'Nova conversa - {{nome}}',
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (channel)
);

-- ----------------------------------------
-- 4.12 OMNI_CHANNEL_CONFIGS
-- OMNI PRO™: Configuração centralizada por canal de comunicação
-- Fonte: 20260308010001_omni_channel_configs-ok.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.omni_channel_configs (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  channel          text        NOT NULL UNIQUE
    CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone')),
  is_active        boolean     DEFAULT false,
  display_name     text        NOT NULL,
  credentials      jsonb       DEFAULT '{}',
  settings         jsonb       DEFAULT '{}',
  webhook_fallback jsonb       DEFAULT '{}',
  business_hours   jsonb       DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ----------------------------------------
-- 4.13 INSTAGRAM_AUTOMATIONS
-- Instagram PRO™: Motor de automação estilo ManyChat
-- Fonte: 20260311100000_instagram_automations.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.instagram_automations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  description         text,
  is_active           boolean     NOT NULL DEFAULT true,
  trigger_type        text        NOT NULL
    CHECK (trigger_type IN ('incoming_dm', 'post_comment', 'story_mention', 'story_reply')),
  filter_operator     text        NOT NULL DEFAULT 'any'
    CHECK (filter_operator IN ('any', 'all')),
  filters             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  action_type         text        NOT NULL
    CHECK (action_type IN ('send_dm', 'reply_comment', 'reply_and_dm')),
  action_dm_text      text,
  action_comment_text text,
  cooldown_hours      integer     NOT NULL DEFAULT 24,
  priority            integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.14 FORM_PRO_FORMS
-- LP PRO™: Definições de formulários (renomeado de lp_forms)
-- Fonte: 20260217200000_lpro_schema-ok.sql + 20260223000000_phase_consolidation.sql
-- Depende de: leads_pipelines
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.form_pro_forms (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  pipeline_id    uuid        REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  fields         jsonb       NOT NULL DEFAULT '[]',
  settings       jsonb       NOT NULL DEFAULT '{}',
  webhook_url    text,
  webhook_secret text,
  create_contact boolean     NOT NULL DEFAULT true,
  create_lead    boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.15 FORM_PRO_SUBMISSIONS
-- LP PRO™: Submissões de formulários (renomeado de lp_submissions)
-- Fonte: 20260217200000_lpro_schema-ok.sql + 20260223000000_phase_consolidation.sql
--         + 20260317600000_form_pro_submissions_flex_fk.sql (form_id nullable, meta_form_id)
-- Depende de: form_pro_forms (4.14), leads, clients_people
-- Nota: page_id mantido como uuid simples (lp_pages pode não existir no tenant)
-- Nota: meta_form_id sem FK (meta_lead_forms pode não existir no tenant)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.form_pro_submissions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      uuid,
  form_id      uuid,
  meta_form_id uuid,
  lead_id      uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  people_id    uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  source       text,
  data         jsonb       NOT NULL DEFAULT '{}',
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  ip_address   inet,
  user_agent   text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.16 CALL_PRO_SETTINGS
-- CALL PRO™: Configurações globais do módulo de ligações
-- Fonte: 20260223000000_phase_consolidation.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.call_pro_settings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_secret       text        NOT NULL DEFAULT '',
  outbound_webhook_url text        NOT NULL DEFAULT '',
  auto_link_leads      boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.17 CALL_PRO_CALLS
-- CALL PRO™: Registro de ligações (inbound e outbound)
-- Fonte: 20260223000000_phase_consolidation.sql
-- Depende de: clients_people, settings_users, leads
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.call_pro_calls (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  as_call_id      text        UNIQUE,
  person_id       uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES public.settings_users(id) ON DELETE SET NULL,
  lead_id         uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  direction       text        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status          text        NOT NULL DEFAULT 'newcall' CHECK (status IN (
    'newcall', 'ringing', 'in_progress', 'abandoned', 'answered',
    'blocked', 'handled', 'missed', 'failed'
  )),
  from_number     text,
  to_number       text,
  duration        int         DEFAULT 0,
  billed_duration int         DEFAULT 0,
  recording_url   text,
  outcome         text,
  tags            text[]      DEFAULT '{}',
  notes           text        DEFAULT '',
  raw_payload     jsonb       DEFAULT '{}',
  started_at      timestamptz NOT NULL DEFAULT now(),
  answered_at     timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- 4.18 ADM_AUDIT_LOG
-- ADM V2™: Registro de operações sensíveis do painel ADM (control plane)
-- Fonte: 20260319300000_adm_audit_log.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.adm_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        NOT NULL,
  actor_email text        NOT NULL,
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   text,
  entity_name text,
  details     jsonb       DEFAULT '{}',
  ip_address  text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- ETAPA REPAIR: Apply pre-epoch column renames and additions
-- These were in migrations 20260218–20260312 but missing from
-- the Dec-2025 snapshot used as baseline. Idempotent for all tenants.
-- ============================================================

-- ── R1. P4 renames: settings_system_modules ativo→is_active, ordem→order_index ─
DO $repair1$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings_system_modules' AND column_name = 'ativo') THEN
    ALTER TABLE public.settings_system_modules RENAME COLUMN ativo TO is_active;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings_system_modules' AND column_name = 'ordem') THEN
    ALTER TABLE public.settings_system_modules RENAME COLUMN ordem TO order_index;
  END IF;
END $repair1$;

-- ── R2. P6 renames: leads_id→lead_id, users_id→user_id, companies_id→company_id ─
DO $repair2$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'leads_id') THEN
    ALTER TABLE public.meetings RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'users_id') THEN
    ALTER TABLE public.meetings RENAME COLUMN users_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meeting_followup_queue' AND column_name = 'leads_id') THEN
    ALTER TABLE public.meeting_followup_queue RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'leads_id') THEN
    ALTER TABLE public.messages RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'users_id') THEN
    ALTER TABLE public.messages RENAME COLUMN users_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads RENAME COLUMN users_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'companies_id') THEN
    ALTER TABLE public.leads RENAME COLUMN companies_id TO company_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads_files' AND column_name = 'leads_id') THEN
    ALTER TABLE public.leads_files RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads_files' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads_files RENAME COLUMN users_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads_notes' AND column_name = 'leads_id') THEN
    ALTER TABLE public.leads_notes RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads_notes' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads_notes RENAME COLUMN users_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads_updates' AND column_name = 'leads_id') THEN
    ALTER TABLE public.leads_updates RENAME COLUMN leads_id TO lead_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads_updates' AND column_name = 'users_id') THEN
    ALTER TABLE public.leads_updates RENAME COLUMN users_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_agents_steps_history' AND column_name = 'leads_id') THEN
    ALTER TABLE public.ai_agents_steps_history RENAME COLUMN leads_id TO lead_id;
  END IF;
END $repair2$;

-- ── R3. Missing columns from pre-epoch migrations ─────────────────────────────
-- ai_agents: is_template (20260223), llm_provider + llm_provider_id (20260302)
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS is_template     boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS llm_provider    text     NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS llm_provider_id uuid;

-- settings_whatsapp_channels: meta_template_name (20260305)
ALTER TABLE public.settings_whatsapp_channels
  ADD COLUMN IF NOT EXISTS meta_template_name text;

-- user_calendar_connections: provider (20260219)
ALTER TABLE public.user_calendar_connections
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google';

-- leads: UTM fields + fb_lead_id (20260110)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fb_lead_id   text,
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term     text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS gclid        text,
  ADD COLUMN IF NOT EXISTS fbclid       text;

-- lead_field_definitions: entity_type (20260227 P4)
-- Note: ETAPA 4 above uses CREATE TABLE IF NOT EXISTS which is a no-op when the
-- table exists from the main section — this ALTER TABLE ensures entity_type exists.
ALTER TABLE public.lead_field_definitions
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'lead';

-- ── R4. _app_config — created in 20260307, used by create_tenant_user RPC ───────
CREATE TABLE IF NOT EXISTS public._app_config (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── R5. pg_net extension — used by create_tenant_user (net.http_post) ──────────
DO $r5_pgnet$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net extension not available: %', SQLERRM;
END $r5_pgnet$;

-- ── R6. is_admin_or_manager() — canonical P4 helper (20260227) ───────────────
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type = 'gestor')
  )
$$;

-- ── R7. merge_persons() — full re-parent (20260310) ──────────────────────────
DROP FUNCTION IF EXISTS public.merge_persons(uuid, uuid);
CREATE OR REPLACE FUNCTION public.merge_persons(
  p_canonical_id  UUID,
  p_duplicate_id  UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_canonical  public.clients_people%ROWTYPE;
  v_duplicate  public.clients_people%ROWTYPE;
  v_msg_count      INT := 0;
  v_lead_count     INT := 0;
  v_meeting_count  INT := 0;
  v_call_count     INT := 0;
BEGIN
  SELECT * INTO v_canonical FROM public.clients_people WHERE id = p_canonical_id FOR UPDATE;
  SELECT * INTO v_duplicate FROM public.clients_people WHERE id = p_duplicate_id FOR UPDATE;

  IF v_canonical.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: canonical_id % not found', p_canonical_id;
  END IF;
  IF v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: duplicate_id % not found', p_duplicate_id;
  END IF;
  IF v_duplicate.status = 'merged' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already merged');
  END IF;

  UPDATE public.messages   SET people_id = p_canonical_id WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;
  UPDATE public.leads      SET people_id = p_canonical_id WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_lead_count = ROW_COUNT;
  UPDATE public.meetings   SET people_id = p_canonical_id WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_meeting_count = ROW_COUNT;
  UPDATE public.call_pro_calls SET person_id = p_canonical_id WHERE person_id = p_duplicate_id;
  GET DIAGNOSTICS v_call_count = ROW_COUNT;

  INSERT INTO public.clients_people_companies (people_id, company_id, role, is_primary, created_at, updated_at)
  SELECT p_canonical_id, company_id, role, is_primary, created_at, updated_at
  FROM   public.clients_people_companies
  WHERE  people_id = p_duplicate_id
    AND  company_id NOT IN (
           SELECT company_id FROM public.clients_people_companies
           WHERE  people_id = p_canonical_id AND company_id IS NOT NULL);
  DELETE FROM public.clients_people_companies WHERE people_id = p_duplicate_id;

  UPDATE public.lp_submissions      SET people_id  = p_canonical_id WHERE people_id  = p_duplicate_id;
  UPDATE public.lp_form_submissions SET contact_id = p_canonical_id WHERE contact_id = p_duplicate_id;
  UPDATE public.sends_contacts      SET people_id  = p_canonical_id WHERE people_id  = p_duplicate_id;
  UPDATE public.followup_queue      SET person_id  = p_canonical_id WHERE person_id  = p_duplicate_id;
  UPDATE public.meeting_followup_queue SET people_id = p_canonical_id WHERE people_id = p_duplicate_id;
  UPDATE public.message_buffer      SET people_id  = p_canonical_id WHERE people_id  = p_duplicate_id;
  UPDATE public.ai_agents_execution_log SET people_id = p_canonical_id WHERE people_id = p_duplicate_id;

  UPDATE public.clients_people SET
    email             = COALESCE(email,             v_duplicate.email),
    document          = COALESCE(document,          v_duplicate.document),
    whatsapp          = COALESCE(whatsapp,          v_duplicate.whatsapp),
    telefone          = COALESCE(telefone,          v_duplicate.telefone),
    instagram_user_id = COALESCE(instagram_user_id, v_duplicate.instagram_user_id),
    instagram_id      = COALESCE(instagram_id,      v_duplicate.instagram_id),
    instagram_handle  = COALESCE(instagram_handle,  v_duplicate.instagram_handle),
    name = CASE
      WHEN name IN ('WhatsApp User', 'Instagram User', '') THEN COALESCE(NULLIF(v_duplicate.name, ''), name)
      ELSE name
    END,
    merge_history = merge_history || jsonb_build_array(
      jsonb_build_object(
        'merged_at', NOW(), 'duplicate_id', p_duplicate_id, 'duplicate_name', v_duplicate.name,
        'messages_moved', v_msg_count, 'leads_moved', v_lead_count,
        'meetings_moved', v_meeting_count, 'calls_moved', v_call_count
      )
    ),
    updated_at = NOW()
  WHERE id = p_canonical_id;

  UPDATE public.clients_people SET
    status = 'merged', merged_into_id = p_canonical_id, updated_at = NOW()
  WHERE id = p_duplicate_id;

  RETURN jsonb_build_object(
    'canonical_id', p_canonical_id, 'duplicate_id', p_duplicate_id,
    'messages_moved', v_msg_count, 'leads_moved', v_lead_count,
    'meetings_moved', v_meeting_count, 'calls_moved', v_call_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_persons TO authenticated, service_role;

-- ── R8. ai_agents missing columns from pre-epoch migrations ──────────────────
-- template_type: added in 20260223000000_phase_consolidation.sql (section 7.6)
-- llm_model:     added in 20260302100000_n8n-waa-1-ai-agents-llm-config-ok.sql
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS template_type text,
  ADD COLUMN IF NOT EXISTS llm_model     text NOT NULL DEFAULT 'gpt-4o-mini';

-- ── R9. lead_field_definitions.agent_managed from 20260224001000 ──────────────
ALTER TABLE public.lead_field_definitions
  ADD COLUMN IF NOT EXISTS agent_managed boolean NOT NULL DEFAULT false;

-- ── R10. find_duplicate_person — from 20260306000000_omni_identity_unification ─
-- Required by the auto-merge trigger installed in that migration.
-- New tenants miss this function since it is defined before the epoch snapshot.
CREATE OR REPLACE FUNCTION public.find_duplicate_person(
  p_exclude_id         UUID,
  p_whatsapp           TEXT DEFAULT NULL,
  p_email              TEXT DEFAULT NULL,
  p_document           TEXT DEFAULT NULL,
  p_instagram_user_id  TEXT DEFAULT NULL,
  p_instagram_handle   TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.clients_people
  WHERE id <> p_exclude_id
    AND status <> 'merged'
    AND (
      (p_whatsapp          IS NOT NULL AND whatsapp          = p_whatsapp) OR
      (p_email             IS NOT NULL AND LOWER(email)      = LOWER(p_email)) OR
      (p_document          IS NOT NULL AND document          = p_document) OR
      (p_instagram_user_id IS NOT NULL AND instagram_user_id = p_instagram_user_id) OR
      (p_instagram_handle  IS NOT NULL AND LOWER(instagram_handle) = LOWER(p_instagram_handle))
    )
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_duplicate_person TO authenticated, service_role;