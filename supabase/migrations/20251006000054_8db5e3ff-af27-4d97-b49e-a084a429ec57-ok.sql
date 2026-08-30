-- Rename CRM tables to English with settings_ prefix
-- Phase 1: Core settings tables

-- System modules
ALTER TABLE IF EXISTS crm_system_modules RENAME TO settings_system_modules;

-- Teams and users
ALTER TABLE IF EXISTS crm_times RENAME TO settings_teams;
ALTER TABLE IF EXISTS crm_usuarios RENAME TO settings_users;
ALTER TABLE IF EXISTS crm_usuario_times RENAME TO settings_users_teams;

-- Schedules
ALTER TABLE IF EXISTS crm_horarios RENAME TO settings_users_schedules;

-- LLM configurations
ALTER TABLE IF EXISTS crm_llm_connections RENAME TO settings_llm_connections;
ALTER TABLE IF EXISTS crm_llm_usage_logs RENAME TO settings_llm_usage_logs;

-- General settings
ALTER TABLE IF EXISTS crm_configuracoes_gerais RENAME TO settings_general;

-- Loss reasons
ALTER TABLE IF EXISTS crm_motivo_perda RENAME TO settings_loss_reasons;

-- Followups configurations
ALTER TABLE IF EXISTS crm_agendamentos_followups RENAME TO settings_schedules_followups;
ALTER TABLE IF EXISTS crm_stage_followups RENAME TO settings_stages_followups;

-- Phase 2: Update foreign key names for better consistency (optional but recommended)
-- Note: This maintains all relationships, just improves naming