-- ==========================================
-- CONSOLIDATION OF DUPLICATE TABLES
-- ==========================================

-- 1. Migrate data from settings_stages_followups to leads_stages_followups if needed
INSERT INTO leads_stages_followups (
  leads_stages_id, type, days, hours, minutes, message, audio_file, 
  template_id, subject, active, created_at, updated_at
)
SELECT 
  stage_id, tipo, dias, horas, minutos, mensagem, arquivo_audio,
  template_id, assunto, ativo, created_at, updated_at
FROM settings_stages_followups
WHERE NOT EXISTS (
  SELECT 1 FROM leads_stages_followups lsf 
  WHERE lsf.leads_stages_id = settings_stages_followups.stage_id
)
ON CONFLICT DO NOTHING;

-- 2. Migrate data from settings_schedules_followups to meetings_followups if needed
INSERT INTO meetings_followups (
  meeting_status, type, days, hours, minutes, message, audio_file,
  template_id, subject, active, created_at, updated_at
)
SELECT 
  status_agendamento, tipo, dias, horas, minutos, mensagem, arquivo_audio,
  template_id, assunto, ativo, created_at, updated_at
FROM settings_schedules_followups
WHERE NOT EXISTS (
  SELECT 1 FROM meetings_followups mf
  WHERE mf.meeting_status = settings_schedules_followups.status_agendamento
)
ON CONFLICT DO NOTHING;

-- 3. Migrate data from settings_loss_reasons to leads_loss_reasons if needed
INSERT INTO leads_loss_reasons (name, created_at, updated_at)
SELECT nome, created_at, updated_at
FROM settings_loss_reasons
WHERE NOT EXISTS (
  SELECT 1 FROM leads_loss_reasons llr
  WHERE llr.name = settings_loss_reasons.nome
)
ON CONFLICT DO NOTHING;

-- Drop duplicate tables
DROP TABLE IF EXISTS settings_stages_followups CASCADE;
DROP TABLE IF EXISTS settings_schedules_followups CASCADE;
DROP TABLE IF EXISTS settings_loss_reasons CASCADE;

-- ==========================================
-- ADD DESCRIPTIONS TO ALL TABLES
-- ==========================================

-- Core Client Tables
COMMENT ON TABLE clients_people IS 'Stores information about people/contacts including personal details, communication preferences, and AI interaction settings';
COMMENT ON TABLE clients_companies IS 'Stores company/organization information including business details and contact information';
COMMENT ON TABLE clients_people_companies IS 'Junction table linking people to companies (many-to-many relationship)';
COMMENT ON TABLE clients_people_updates IS 'Audit log tracking all changes made to people records';
COMMENT ON TABLE clients_companies_updates IS 'Audit log tracking all changes made to company records';

-- Leads/Deals Tables
COMMENT ON TABLE leads IS 'Stores sales leads/deals with pipeline tracking, stage progression, and UTM campaign data';
COMMENT ON TABLE leads_pipelines IS 'Defines sales pipelines with different stages for lead progression';
COMMENT ON TABLE leads_stages IS 'Defines stages within pipelines (e.g., Qualification, Proposal, Negotiation)';
COMMENT ON TABLE leads_stages_followups IS 'Automated follow-up configurations triggered when leads enter specific stages';
COMMENT ON TABLE leads_loss_reasons IS 'Predefined reasons for marking leads as lost (e.g., Budget, Timing, Competition)';
COMMENT ON TABLE leads_notes IS 'Notes and comments added to leads by users';
COMMENT ON TABLE leads_files IS 'Files and documents attached to leads';
COMMENT ON TABLE leads_updates IS 'Audit log tracking all changes made to lead records';

-- Meetings Tables
COMMENT ON TABLE meetings IS 'Stores scheduled meetings/appointments with leads including date, time, and status';
COMMENT ON TABLE meetings_followups IS 'Automated follow-up configurations based on meeting status (scheduled, completed, no-show)';
COMMENT ON TABLE meetings_updates IS 'Audit log tracking all changes made to meeting records';

-- Messages/Communication Tables
COMMENT ON TABLE messages IS 'Stores all messages exchanged with leads across channels (WhatsApp, Email, etc.)';

-- Settings Tables
COMMENT ON TABLE settings IS 'Global system settings including company branding, timezone, and currency';
COMMENT ON TABLE settings_general IS 'Legacy general settings table (Portuguese column names)';
COMMENT ON TABLE settings_users IS 'System users with roles and permissions (gestores, super admins)';
COMMENT ON TABLE settings_users_schedules IS 'Working hours/availability schedules for users by day of week';
COMMENT ON TABLE settings_teams IS 'Teams/groups for organizing users and assigning leads';
COMMENT ON TABLE settings_users_teams IS 'Junction table linking users to teams (many-to-many relationship)';
COMMENT ON TABLE settings_system_modules IS 'Controls which system modules are active/visible (Deals, Clients, Appointments)';

-- Security Tables
COMMENT ON TABLE security_audit_logs IS 'Security audit trail logging user actions, IP addresses, and access patterns';

-- Add column comments for key fields
COMMENT ON COLUMN clients_people.ai_enabled IS 'Whether AI assistant can interact with this person';
COMMENT ON COLUMN clients_people.service_status IS 'Current service status: aberto (open), em-atendimento (in-service), fechado (closed)';
COMMENT ON COLUMN clients_people.disc_profile IS 'DISC personality profile for better communication';
COMMENT ON COLUMN clients_people.conversation_summary IS 'AI-generated summary of conversation history';

COMMENT ON COLUMN leads.status IS 'Lead status: em-andamento (in-progress), ganho (won), perdido (lost), arquivado (archived)';
COMMENT ON COLUMN leads.control IS 'AI control status for automated interactions';
COMMENT ON COLUMN leads.followup_attempts IS 'Number of automated follow-up attempts made';
COMMENT ON COLUMN leads.utm_campaign IS 'UTM campaign parameter for tracking marketing source';
COMMENT ON COLUMN leads.utm_source IS 'UTM source parameter (e.g., google, facebook)';
COMMENT ON COLUMN leads.utm_medium IS 'UTM medium parameter (e.g., cpc, email, social)';

COMMENT ON COLUMN settings_users.gestor IS 'Whether user has manager/admin permissions';
COMMENT ON COLUMN settings_users.super_adm IS 'Whether user has super admin permissions (full system access)';
COMMENT ON COLUMN settings_users.auth_user_id IS 'Foreign key to Supabase auth.users table';

COMMENT ON COLUMN messages.channel IS 'Communication channel: whatsapp, email, phone, etc.';
COMMENT ON COLUMN messages.message_type IS 'Message type: texto (text), audio, image, video, document';
COMMENT ON COLUMN messages.from_contact IS 'Whether message is from contact (true) or to contact (false)';
COMMENT ON COLUMN messages.llm IS 'LLM model used for AI-generated responses';
COMMENT ON COLUMN messages.tokens_qty IS 'Number of tokens consumed for AI processing';