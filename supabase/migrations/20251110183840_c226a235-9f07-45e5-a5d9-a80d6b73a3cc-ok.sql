-- ============================================
-- MIGRAÇÃO CONSOLIDADA ÚNICA - DATABASE SCHEMA COMPLETO
-- ============================================

-- FASE 1: FUNCTIONS AUXILIARES
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FASE 2: TABELAS BASE (SETTINGS E CONFIGURAÇÕES)
-- ============================================

-- Tabela: settings_users
CREATE TABLE IF NOT EXISTS settings_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  user_type TEXT DEFAULT 'atendente' CHECK (user_type IN ('gestor', 'atendente')),
  avatar_url TEXT,
  phone TEXT,
  super_admin BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_users_auth ON settings_users(auth_user_id);
CREATE INDEX idx_settings_users_email ON settings_users(email);
CREATE INDEX idx_settings_users_active ON settings_users(active);

-- Tabela: settings_teams
CREATE TABLE IF NOT EXISTS settings_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  team_type TEXT DEFAULT 'vendas' CHECK (team_type IN ('vendas', 'atendimento', 'suporte', 'outro')),
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_teams_active ON settings_teams(active);

-- Tabela: settings_users_teams (N:N)
CREATE TABLE IF NOT EXISTS settings_users_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES settings_users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES settings_teams(id) ON DELETE CASCADE,
  is_leader BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

CREATE INDEX idx_settings_users_teams_user ON settings_users_teams(user_id);
CREATE INDEX idx_settings_users_teams_team ON settings_users_teams(team_id);

-- Tabela: settings_modules
CREATE TABLE IF NOT EXISTS settings_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: settings_schedules
CREATE TABLE IF NOT EXISTS settings_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES settings_users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_schedules_user ON settings_schedules(user_id);

-- FASE 3: GESTÃO DE PESSOAS E EMPRESAS
-- ============================================

-- Tabela: clients_people
CREATE TABLE IF NOT EXISTS clients_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  document TEXT,
  status TEXT DEFAULT 'ativo',
  service_status TEXT,
  ai_enabled BOOLEAN DEFAULT FALSE,
  accepts_calls BOOLEAN DEFAULT TRUE,
  notes TEXT,
  source TEXT,
  type TEXT,
  income TEXT,
  moment TEXT,
  goal TEXT,
  disc_profile TEXT,
  disc_summary TEXT,
  conversation_summary TEXT,
  score INTEGER,
  score_matrix_id UUID,
  score_framing_id UUID,
  score_income_id UUID,
  score_objective_id UUID,
  q1_age INTEGER,
  q2_has_children BOOLEAN,
  q3_number_of_children INTEGER,
  q4_qualification_1 TEXT,
  q5_qualification_area TEXT,
  q6_profession_current TEXT,
  q7_profession_years TEXT,
  q8_professional_recognition TEXT,
  q9_foreign_citizenship BOOLEAN,
  q10_migration_process TEXT,
  q11_decision_move_usa TEXT,
  q12_start_process_time TEXT,
  q13_household_income TEXT,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_people_whatsapp ON clients_people(whatsapp);
CREATE INDEX idx_clients_people_email ON clients_people(email);
CREATE INDEX idx_clients_people_status ON clients_people(status);
CREATE INDEX idx_clients_people_archived ON clients_people(archived);
CREATE INDEX idx_clients_people_score_matrix ON clients_people(score_matrix_id);

-- Tabela: clients_companies
CREATE TABLE IF NOT EXISTS clients_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_companies_tax_id ON clients_companies(tax_id);

-- Tabela: clients_people_updates (histórico)
CREATE TABLE IF NOT EXISTS clients_people_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id UUID REFERENCES clients_people(id) ON DELETE CASCADE,
  user_id UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_people_updates_people ON clients_people_updates(people_id);

-- FASE 4: PIPELINE DE VENDAS E NEGÓCIOS
-- ============================================

-- Tabela: leads_pipelines
CREATE TABLE IF NOT EXISTS leads_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_pipelines_active ON leads_pipelines(active);

-- Tabela: leads_stages
CREATE TABLE IF NOT EXISTS leads_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leads_pipelines_id UUID REFERENCES leads_pipelines(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leads_pipelines_id, order_index)
);

CREATE INDEX idx_leads_stages_pipeline ON leads_stages(leads_pipelines_id);
CREATE INDEX idx_leads_stages_active ON leads_stages(active);
CREATE INDEX idx_leads_stages_order ON leads_stages(leads_pipelines_id, order_index);

-- Tabela: leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id UUID REFERENCES clients_people(id) ON DELETE CASCADE,
  companies_id UUID REFERENCES clients_companies(id) ON DELETE SET NULL,
  leads_pipelines_id UUID REFERENCES leads_pipelines(id) ON DELETE CASCADE,
  leads_stages_id UUID REFERENCES leads_stages(id) ON DELETE SET NULL,
  teams_id UUID REFERENCES settings_teams(id) ON DELETE SET NULL,
  users_id UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'em-andamento' CHECK (status IN ('em-andamento', 'ganho', 'perdido', 'arquivado')),
  value DECIMAL(10, 2) DEFAULT 0,
  title TEXT,
  description TEXT,
  control TEXT,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_people ON leads(people_id);
CREATE INDEX idx_leads_pipeline ON leads(leads_pipelines_id);
CREATE INDEX idx_leads_stage ON leads(leads_stages_id);
CREATE INDEX idx_leads_team ON leads(teams_id);
CREATE INDEX idx_leads_user ON leads(users_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_archived ON leads(archived);

-- Tabela: leads_notes
CREATE TABLE IF NOT EXISTS leads_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  users_id UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_notes_leads ON leads_notes(leads_id);

-- Tabela: leads_files
CREATE TABLE IF NOT EXISTS leads_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  users_id UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_files_leads ON leads_files(leads_id);

-- Tabela: leads_updates (histórico de movimentações)
CREATE TABLE IF NOT EXISTS leads_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  users_id UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  from_stage_id UUID REFERENCES leads_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES leads_stages(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_updates_leads ON leads_updates(leads_id);

-- Tabela: leads_loss_reasons
CREATE TABLE IF NOT EXISTS leads_loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: leads_stages_followups
CREATE TABLE IF NOT EXISTS leads_stages_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID REFERENCES leads_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  delay_minutes INTEGER DEFAULT 60,
  whatsapp_template_id TEXT,
  score_matrix_id UUID,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_stages_followups_stage ON leads_stages_followups(stage_id);

-- FASE 5: MENSAGENS E COMUNICAÇÃO
-- ============================================

-- Tabela: messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  leads_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  people_id UUID REFERENCES clients_people(id) ON DELETE CASCADE,
  users_id UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  from_contact TEXT DEFAULT 'cliente' CHECK (from_contact IN ('cliente', 'humano', 'ia')),
  message_type TEXT DEFAULT 'texto' CHECK (message_type IN ('texto', 'audio', 'imagem', 'video', 'documento')),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviada', 'entregue', 'lida', 'erro')),
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'sms')),
  whatsapp_template_id TEXT,
  followup_id UUID REFERENCES leads_stages_followups(id) ON DELETE SET NULL,
  media_url TEXT,
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_leads ON messages(leads_id);
CREATE INDEX idx_messages_people ON messages(people_id);
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Tabela: whatsapp_templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_template TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'ativo',
  system_enabled BOOLEAN DEFAULT TRUE,
  json_data JSONB,
  variables JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_templates_status ON whatsapp_templates(status);
CREATE INDEX idx_whatsapp_templates_slug ON whatsapp_templates(slug);

-- FASE 6: AGENDAMENTOS E REUNIÕES
-- ============================================

-- Tabela: meetings
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  people_id UUID REFERENCES clients_people(id) ON DELETE CASCADE,
  leads_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  users_id UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  teams_id UUID REFERENCES settings_teams(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  meeting_link TEXT,
  status TEXT DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada', 'remarcada')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetings_people ON meetings(people_id);
CREATE INDEX idx_meetings_leads ON meetings(leads_id);
CREATE INDEX idx_meetings_user ON meetings(users_id);
CREATE INDEX idx_meetings_team ON meetings(teams_id);
CREATE INDEX idx_meetings_start ON meetings(start_time);
CREATE INDEX idx_meetings_status ON meetings(status);

-- FASE 7: SCORE E QUALIFICAÇÃO DE LEADS
-- ============================================

-- Tabela: score_objectives
CREATE TABLE IF NOT EXISTS score_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: score_incomes
CREATE TABLE IF NOT EXISTS score_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: score_framings
CREATE TABLE IF NOT EXISTS score_framings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: score_matrix
CREATE TABLE IF NOT EXISTS score_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES score_objectives(id) ON DELETE CASCADE,
  income_id UUID REFERENCES score_incomes(id) ON DELETE CASCADE,
  framing_id UUID REFERENCES score_framings(id) ON DELETE CASCADE,
  score_number INTEGER NOT NULL,
  detail_score TEXT,
  profile_score TEXT,
  pre_description_score TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(objective_id, income_id, framing_id)
);

CREATE INDEX idx_score_matrix_combo ON score_matrix(objective_id, income_id, framing_id);

-- Adicionar FKs na tabela clients_people
ALTER TABLE clients_people
  ADD CONSTRAINT fk_score_matrix FOREIGN KEY (score_matrix_id) REFERENCES score_matrix(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_score_framing FOREIGN KEY (score_framing_id) REFERENCES score_framings(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_score_income FOREIGN KEY (score_income_id) REFERENCES score_incomes(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_score_objective FOREIGN KEY (score_objective_id) REFERENCES score_objectives(id) ON DELETE SET NULL;

-- FASE 8: AGENTES IA E AUTOMAÇÃO
-- ============================================

-- Tabela: ai_agents
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  identity TEXT,
  general_rules TEXT,
  input_data TEXT,
  use_stages BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  current_version INTEGER DEFAULT 1,
  pipeline_id UUID REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  score_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: ai_agents_steps
CREATE TABLE IF NOT EXISTS ai_agents_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  control TEXT,
  order_index INTEGER NOT NULL,
  pipeline_id UUID REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agents_steps_agent ON ai_agents_steps(ai_agent_id);
CREATE INDEX idx_ai_agents_steps_order ON ai_agents_steps(ai_agent_id, order_index);

-- Tabela: ai_agents_history
CREATE TABLE IF NOT EXISTS ai_agents_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changelog JSONB,
  data JSONB NOT NULL,
  created_by UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agents_history_agent ON ai_agents_history(ai_agent_id);

-- Tabela: ai_agents_steps_history
CREATE TABLE IF NOT EXISTS ai_agents_steps_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES ai_agents_steps(id) ON DELETE CASCADE,
  leads_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN,
  result JSONB,
  error_message TEXT
);

CREATE INDEX idx_ai_agents_steps_history_step ON ai_agents_steps_history(step_id);
CREATE INDEX idx_ai_agents_steps_history_lead ON ai_agents_steps_history(leads_id);

-- Tabela: ai_agents_score_matrix
CREATE TABLE IF NOT EXISTS ai_agents_score_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  score_matrix_id UUID REFERENCES score_matrix(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ai_agent_id, score_matrix_id)
);

CREATE INDEX idx_ai_agents_score_matrix_agent ON ai_agents_score_matrix(ai_agent_id);

-- FASE 9: DISPAROS EM MASSA
-- ============================================

-- Tabela: sends
CREATE TABLE IF NOT EXISTS sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_id TEXT,
  pipeline_id UUID REFERENCES leads_pipelines(id) ON DELETE SET NULL,
  stage_ids UUID[],
  team_id UUID REFERENCES settings_teams(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES settings_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sends_status ON sends(status);
CREATE INDEX idx_sends_pipeline ON sends(pipeline_id);

-- Tabela: sends_contacts
CREATE TABLE IF NOT EXISTS sends_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id UUID REFERENCES sends(id) ON DELETE CASCADE,
  people_id UUID REFERENCES clients_people(id) ON DELETE CASCADE,
  whatsapp TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'error')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sends_contacts_send ON sends_contacts(send_id);
CREATE INDEX idx_sends_contacts_people ON sends_contacts(people_id);
CREATE INDEX idx_sends_contacts_status ON sends_contacts(status);

-- FASE 10: WEBHOOKS
-- ============================================

-- Tabela: webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_type TEXT NOT NULL,
  headers JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_event ON webhooks(event_type);
CREATE INDEX idx_webhooks_active ON webhooks(active);

-- Tabela: webhook_logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  status_code INTEGER,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- FASE 11: TRIGGERS
-- ============================================

-- Trigger para settings_users
CREATE TRIGGER trigger_update_settings_users_updated_at
  BEFORE UPDATE ON settings_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para settings_teams
CREATE TRIGGER trigger_update_settings_teams_updated_at
  BEFORE UPDATE ON settings_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para settings_modules
CREATE TRIGGER trigger_update_settings_modules_updated_at
  BEFORE UPDATE ON settings_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para settings_schedules
CREATE TRIGGER trigger_update_settings_schedules_updated_at
  BEFORE UPDATE ON settings_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para clients_people
CREATE TRIGGER trigger_update_clients_people_updated_at
  BEFORE UPDATE ON clients_people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para clients_companies
CREATE TRIGGER trigger_update_clients_companies_updated_at
  BEFORE UPDATE ON clients_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para leads_pipelines
CREATE TRIGGER trigger_update_leads_pipelines_updated_at
  BEFORE UPDATE ON leads_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para leads_stages
CREATE TRIGGER trigger_update_leads_stages_updated_at
  BEFORE UPDATE ON leads_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para leads
CREATE TRIGGER trigger_update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para leads_notes
CREATE TRIGGER trigger_update_leads_notes_updated_at
  BEFORE UPDATE ON leads_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para leads_stages_followups
CREATE TRIGGER trigger_update_leads_stages_followups_updated_at
  BEFORE UPDATE ON leads_stages_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para messages
CREATE TRIGGER trigger_update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para whatsapp_templates
CREATE TRIGGER trigger_update_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para meetings
CREATE TRIGGER trigger_update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para score_objectives
CREATE TRIGGER trigger_update_score_objectives_updated_at
  BEFORE UPDATE ON score_objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para score_incomes
CREATE TRIGGER trigger_update_score_incomes_updated_at
  BEFORE UPDATE ON score_incomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para score_framings
CREATE TRIGGER trigger_update_score_framings_updated_at
  BEFORE UPDATE ON score_framings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para score_matrix
CREATE TRIGGER trigger_update_score_matrix_updated_at
  BEFORE UPDATE ON score_matrix
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para ai_agents
CREATE TRIGGER trigger_update_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para ai_agents_steps
CREATE TRIGGER trigger_update_ai_agents_steps_updated_at
  BEFORE UPDATE ON ai_agents_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para sends
CREATE TRIGGER trigger_update_sends_updated_at
  BEFORE UPDATE ON sends
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para webhooks
CREATE TRIGGER trigger_update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para leads_loss_reasons
CREATE TRIGGER trigger_update_leads_loss_reasons_updated_at
  BEFORE UPDATE ON leads_loss_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- FASE 12: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em TODAS as tabelas
ALTER TABLE settings_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_users_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients_people_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_stages_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_framings ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents_steps_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents_score_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE sends_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policies genéricas (usuários autenticados podem ler/escrever)
CREATE POLICY "authenticated_read" ON settings_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON settings_users FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON settings_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON settings_teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON settings_users_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON settings_users_teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON settings_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON settings_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON settings_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON settings_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON clients_people FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON clients_people FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON clients_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON clients_companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON clients_people_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON clients_people_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads_pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads_pipelines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads_loss_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads_loss_reasons FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON leads_stages_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON leads_stages_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON whatsapp_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON whatsapp_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON score_objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON score_objectives FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON score_incomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON score_incomes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON score_framings FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON score_framings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON score_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON score_matrix FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON ai_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON ai_agents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON ai_agents_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON ai_agents_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON ai_agents_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON ai_agents_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON ai_agents_steps_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON ai_agents_steps_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON ai_agents_score_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON ai_agents_score_matrix FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON sends FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON sends FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON sends_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON sends_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON webhooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON webhooks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON webhook_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON webhook_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FASE 13: DADOS SEED (INICIAIS)
-- ============================================

-- Módulos do Sistema
INSERT INTO settings_modules (module_name, display_name, enabled, description) VALUES
  ('dashboard', 'Dashboard', true, 'Visão geral e KPIs'),
  ('conversas', 'Conversas', true, 'Gestão de conversas e mensagens'),
  ('negocios', 'Negócios', true, 'Gestão de leads e negócios'),
  ('clientes', 'Clientes', true, 'Gestão de pessoas e empresas'),
  ('reunioes', 'Reuniões', true, 'Agendamento e gestão de reuniões'),
  ('followups', 'Follow-ups', true, 'Follow-ups automáticos'),
  ('disparos', 'Disparos', true, 'Disparos em massa'),
  ('agentes-ia', 'Agentes IA', true, 'Agentes de IA e automação'),
  ('configuracoes', 'Configurações', true, 'Configurações do sistema')
ON CONFLICT (module_name) DO NOTHING;

-- Pipeline Padrão
INSERT INTO leads_pipelines (name, description, active) VALUES
  ('Pipeline de Vendas', 'Funil principal de vendas', true)
ON CONFLICT DO NOTHING;

-- Buscar ID do pipeline e criar stages
DO $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  SELECT id INTO v_pipeline_id FROM leads_pipelines WHERE name = 'Pipeline de Vendas' LIMIT 1;
  
  IF v_pipeline_id IS NOT NULL THEN
    INSERT INTO leads_stages (name, leads_pipelines_id, order_index, color, active) VALUES
      ('Novo Lead', v_pipeline_id, 0, '#3b82f6', true),
      ('Qualificação', v_pipeline_id, 1, '#8b5cf6', true),
      ('Proposta', v_pipeline_id, 2, '#f59e0b', true),
      ('Negociação', v_pipeline_id, 3, '#ef4444', true),
      ('Fechado', v_pipeline_id, 4, '#10b981', true)
    ON CONFLICT (leads_pipelines_id, order_index) DO NOTHING;
  END IF;
END $$;

-- Motivos de Perda
INSERT INTO leads_loss_reasons (name, description) VALUES
  ('Preço muito alto', 'Cliente considerou o preço acima do orçamento'),
  ('Escolheu concorrente', 'Cliente optou por outra solução'),
  ('Sem verba', 'Cliente não possui verba disponível'),
  ('Não retornou contato', 'Cliente não respondeu após tentativas'),
  ('Não tem interesse', 'Cliente perdeu interesse na solução')
ON CONFLICT DO NOTHING;

-- Score Bases (Objectives, Incomes, Framings)
INSERT INTO score_objectives (name, description) VALUES
  ('Comprar Imóvel', 'Cliente deseja comprar imóvel'),
  ('Vender Imóvel', 'Cliente deseja vender imóvel'),
  ('Alugar Imóvel', 'Cliente deseja alugar imóvel'),
  ('Investir em Imóveis', 'Cliente deseja investir')
ON CONFLICT (name) DO NOTHING;

INSERT INTO score_incomes (name, description) VALUES
  ('Até R$ 5.000', 'Renda até 5 mil reais'),
  ('R$ 5.001 - R$ 10.000', 'Renda entre 5 e 10 mil'),
  ('R$ 10.001 - R$ 20.000', 'Renda entre 10 e 20 mil'),
  ('Acima de R$ 20.000', 'Renda acima de 20 mil')
ON CONFLICT (name) DO NOTHING;

INSERT INTO score_framings (name, description) VALUES
  ('Primeira Compra', 'Primeira vez comprando'),
  ('Já Possui Imóvel', 'Já possui um ou mais imóveis'),
  ('Investidor', 'Investidor profissional'),
  ('Corretor', 'Corretor de imóveis')
ON CONFLICT (name) DO NOTHING;