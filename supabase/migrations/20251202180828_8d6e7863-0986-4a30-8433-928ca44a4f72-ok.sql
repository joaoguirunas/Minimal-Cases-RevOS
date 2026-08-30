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