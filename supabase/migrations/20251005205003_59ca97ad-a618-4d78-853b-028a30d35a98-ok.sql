-- =============================================
-- REFATORAÇÃO COMPLETA DO BANCO DE DADOS
-- Nomenclatura em inglês + FKs padronizadas
-- =============================================

-- ============= MÓDULO: TEAMS =============
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_access_policy" ON teams FOR ALL USING (true);

-- ============= MÓDULO: USERS =============
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  whatsapp text,
  is_manager boolean NOT NULL DEFAULT false,
  is_super_admin boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  deleted_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_access_policy" ON users FOR ALL 
USING ((auth.uid() = auth_user_id) OR is_super_admin());
CREATE POLICY "users_insert_policy" ON users FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

CREATE TABLE IF NOT EXISTS users_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  users_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teams_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(users_id, teams_id)
);

ALTER TABLE users_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_teams_access_policy" ON users_teams FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS users_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  users_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_schedules_access_policy" ON users_schedules FOR ALL USING (true);

-- ============= MÓDULO: SETTINGS =============
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  tax_id text,
  email text,
  phone text,
  address text,
  website text,
  logo_url text,
  language text DEFAULT 'pt-br',
  currency text DEFAULT 'BRL',
  timezone text DEFAULT 'America/Sao_Paulo',
  primary_color text DEFAULT '#F26B2F',
  secondary_color text DEFAULT '#3B82F6',
  accent_color text DEFAULT '#6C16F8',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_access_policy" ON settings FOR ALL USING (true);

-- ============= MÓDULO: COMPANIES =============
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  legal_name text,
  tax_id text,
  phone text,
  email text,
  website text,
  status text DEFAULT 'ativo',
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_access_policy" ON companies FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS companies_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  companies_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  change_type text NOT NULL DEFAULT 'update'
);

ALTER TABLE companies_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_updates_access_policy" ON companies_updates FOR ALL USING (true);

-- ============= MÓDULO: PEOPLE =============
CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  whatsapp text,
  document text,
  source text DEFAULT 'manual',
  status text DEFAULT 'ativo',
  service_status text DEFAULT 'aberto',
  notes text,
  moment text,
  goal text,
  income text,
  type text,
  score integer,
  disc_profile text,
  disc_summary text,
  conversation_summary text,
  summary_message_counter integer DEFAULT 0,
  ai_enabled boolean DEFAULT true,
  accepts_calls boolean DEFAULT true,
  whatsapp_remote_id text,
  external_crm_person_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people_access_policy" ON people FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS people_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  change_type text NOT NULL DEFAULT 'update'
);

ALTER TABLE people_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people_updates_access_policy" ON people_updates FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS people_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  companies_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(people_id, companies_id)
);

ALTER TABLE people_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people_companies_access_policy" ON people_companies FOR ALL USING (true);

-- ============= MÓDULO: LEADS PIPELINES & STAGES =============
CREATE TABLE IF NOT EXISTS leads_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_pipelines_access_policy" ON leads_pipelines FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS leads_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_pipelines_id uuid NOT NULL REFERENCES leads_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  color text DEFAULT '#3B82F6',
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_stages_access_policy" ON leads_stages FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS leads_stages_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_stages_id uuid NOT NULL REFERENCES leads_stages(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'texto',
  message text,
  subject text,
  template_id text,
  audio_file text,
  days integer NOT NULL DEFAULT 0,
  hours integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads_stages_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_stages_followups_access_policy" ON leads_stages_followups FOR ALL USING (true);

-- ============= MÓDULO: LEADS LOSS REASONS =============
CREATE TABLE IF NOT EXISTS leads_loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads_loss_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_loss_reasons_access_policy" ON leads_loss_reasons FOR ALL USING (true);

-- ============= MÓDULO: LEADS =============
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  companies_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  leads_pipelines_id uuid NOT NULL REFERENCES leads_pipelines(id) ON DELETE CASCADE,
  leads_stages_id uuid NOT NULL REFERENCES leads_stages(id) ON DELETE CASCADE,
  users_id uuid REFERENCES users(id) ON DELETE SET NULL,
  teams_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  leads_loss_reasons_id uuid REFERENCES leads_loss_reasons(id) ON DELETE SET NULL,
  title text,
  value numeric,
  status text DEFAULT 'em-andamento',
  control text,
  loss_reason text,
  ai_blocked boolean DEFAULT false,
  ai_blocked_until timestamptz,
  last_interaction text,
  last_interaction_at timestamptz,
  followup_attempts integer DEFAULT 0,
  followup_status text,
  won_at timestamptz,
  external_crm_lead_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_access_policy" ON leads FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS leads_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  change_type text NOT NULL DEFAULT 'update'
);

ALTER TABLE leads_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_updates_access_policy" ON leads_updates FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS leads_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  users_id uuid REFERENCES users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_files_access_policy" ON leads_files FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS leads_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  users_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_notes_access_policy" ON leads_notes FOR ALL USING (true);

-- ============= MÓDULO: MEETINGS =============
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  users_id uuid REFERENCES users(id) ON DELETE SET NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  notes text,
  status text DEFAULT 'agendado',
  source text DEFAULT 'manual',
  quantity bigint,
  attendees text[],
  google_meet_link text,
  calendar_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_access_policy" ON meetings FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS meetings_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meetings_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  change_type text NOT NULL DEFAULT 'update'
);

ALTER TABLE meetings_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_updates_access_policy" ON meetings_updates FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS meetings_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_status text NOT NULL,
  type text NOT NULL DEFAULT 'texto',
  message text,
  subject text,
  template_id text,
  audio_file text,
  days integer NOT NULL DEFAULT 0,
  hours integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meetings_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_followups_access_policy" ON meetings_followups FOR ALL USING (true);

-- ============= MÓDULO: MESSAGES =============
CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  leads_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  people_id uuid REFERENCES people(id) ON DELETE SET NULL,
  users_id uuid REFERENCES users(id) ON DELETE SET NULL,
  followup_id uuid,
  content text NOT NULL,
  from_contact text NOT NULL,
  channel text DEFAULT 'whatsapp',
  message_type text DEFAULT 'texto',
  audio_url text,
  audio_duration integer,
  transcription text,
  tokens_qty integer,
  llm text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_access_policy" ON messages FOR ALL USING (true);

-- ============= MÓDULO: CAMPAIGNS =============
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  leads_pipelines_id uuid REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  leads_stages_id uuid REFERENCES leads_stages(id) ON DELETE SET NULL,
  wait_time text NOT NULL DEFAULT '5_min',
  interval_start time NOT NULL DEFAULT '09:00:00',
  interval_end time NOT NULL DEFAULT '18:00:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_access_policy" ON campaigns FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS campaigns_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaigns_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  change_type text NOT NULL DEFAULT 'update'
);

ALTER TABLE campaigns_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_updates_access_policy" ON campaigns_updates FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS campaigns_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaigns_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  leads_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  send_status text NOT NULL DEFAULT 'pendente',
  sent_at timestamptz,
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaigns_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_contacts_access_policy" ON campaigns_contacts FOR ALL USING (true);

-- ============= MÓDULO: AI AGENTS =============
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  leads_pipelines_id uuid REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  identity text,
  base_prompt text,
  general_rules text,
  input_data text,
  use_stages boolean NOT NULL DEFAULT false,
  current_version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents_access_policy" ON ai_agents FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS ai_agents_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agents_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  leads_pipelines_id uuid REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  leads_stages_id uuid REFERENCES leads_stages(id) ON DELETE SET NULL,
  stage_name text NOT NULL,
  stage_prompt text NOT NULL,
  order_index integer NOT NULL,
  control text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_agents_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents_stages_access_policy" ON ai_agents_stages FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS ai_agents_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agents_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  identity text,
  general_rules text,
  base_prompt text,
  input_data text,
  use_stages boolean NOT NULL DEFAULT false,
  changelog text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_agents_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents_history_access_policy" ON ai_agents_history FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS ai_agents_stages_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agents_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  stage_name text NOT NULL,
  stage_prompt text NOT NULL,
  order_index integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_agents_stages_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents_stages_history_access_policy" ON ai_agents_stages_history FOR ALL USING (true);

-- ============= MÓDULO: KNOWLEDGE BASE =============
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  original_content text NOT NULL,
  file_url text,
  source text DEFAULT 'upload_manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_bases_access_policy" ON knowledge_bases FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS knowledge_bases_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_bases_id uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_order integer NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_bases_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_bases_chunks_access_policy" ON knowledge_bases_chunks FOR ALL USING (true);

-- ============= MÓDULO: LLM =============
CREATE TABLE IF NOT EXISTS llm_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  default_model text NOT NULL,
  api_key text NOT NULL,
  temperature numeric DEFAULT 0.7,
  max_tokens integer,
  active boolean NOT NULL DEFAULT true,
  connection_status text DEFAULT 'não_testado',
  error_message text,
  last_test_at timestamptz,
  additional_config jsonb DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llm_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "llm_connections_access_policy" ON llm_connections FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  llm_connections_id uuid REFERENCES llm_connections(id) ON DELETE SET NULL,
  users_id uuid REFERENCES users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_preview text,
  tokens_input integer,
  tokens_output integer,
  tokens_total integer,
  estimated_cost numeric,
  response_time integer,
  success boolean NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "llm_usage_logs_access_policy" ON llm_usage_logs FOR ALL USING (true);

CREATE OR REPLACE FUNCTION calculate_tokens_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tokens_total := COALESCE(NEW.tokens_input, 0) + COALESCE(NEW.tokens_output, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER llm_usage_logs_tokens_trigger
BEFORE INSERT OR UPDATE ON llm_usage_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_tokens_total();

-- ============= MÓDULO: SECURITY =============
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  users_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_audit_logs_access_policy" ON security_audit_logs FOR ALL USING (true);

-- ============= MÓDULO: SYSTEM =============
CREATE TABLE IF NOT EXISTS system_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  order_index integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_modules_select_policy" ON system_modules FOR SELECT USING (true);
CREATE POLICY "system_modules_admin_policy" ON system_modules FOR ALL 
USING ((EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.is_super_admin = true)));

-- ============= TRIGGERS PARA UPDATED_AT =============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_people_companies_updated_at BEFORE UPDATE ON people_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_pipelines_updated_at BEFORE UPDATE ON leads_pipelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_stages_updated_at BEFORE UPDATE ON leads_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_stages_followups_updated_at BEFORE UPDATE ON leads_stages_followups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_loss_reasons_updated_at BEFORE UPDATE ON leads_loss_reasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_files_updated_at BEFORE UPDATE ON leads_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_notes_updated_at BEFORE UPDATE ON leads_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_followups_updated_at BEFORE UPDATE ON meetings_followups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_contacts_updated_at BEFORE UPDATE ON campaigns_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_agents_stages_updated_at BEFORE UPDATE ON ai_agents_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_bases_chunks_updated_at BEFORE UPDATE ON knowledge_bases_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_llm_connections_updated_at BEFORE UPDATE ON llm_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_modules_updated_at BEFORE UPDATE ON system_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();