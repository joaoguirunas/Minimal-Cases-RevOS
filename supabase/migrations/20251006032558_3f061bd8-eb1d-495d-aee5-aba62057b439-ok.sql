-- Fase 1: Copiar dados das tabelas clients_* incorretas para as corretas

-- Copiar dados de clients_leads para leads (se houver)
INSERT INTO leads (
  id, people_id, leads_pipelines_id, leads_stages_id, title, value, status,
  users_id, teams_id, companies_id, control, ai_blocked, ai_blocked_until,
  last_interaction, last_interaction_at, followup_status, followup_attempts,
  loss_reason, leads_loss_reasons_id, won_at, utm_source, utm_medium, utm_campaign,
  utm_term, utm_content, gclid, fbclid, external_crm_lead_id, metadata,
  created_at, updated_at
)
SELECT 
  id, people_id, pipelines_id, stages_id, title, value, status,
  users_id, teams_id, companies_id, control, ai_blocked, ai_blocked_until,
  last_interaction, last_interaction_at, followup_status, followup_attempts,
  loss_reason, loss_reasons_id, won_at, utm_source, utm_medium, utm_campaign,
  utm_term, utm_content, gclid, fbclid, external_crm_lead_id, metadata,
  created_at, updated_at
FROM clients_leads
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_messages para messages (se houver)
INSERT INTO messages (
  id, leads_id, people_id, users_id, from_contact, content, message_type,
  audio_url, audio_duration, transcription, channel, tokens_qty, llm,
  followup_id, metadata, created_at, updated_at
)
SELECT 
  id, leads_id, people_id, users_id, from_contact, content, message_type,
  audio_url, audio_duration, transcription, channel, tokens_qty, llm,
  followup_id, metadata, created_at, updated_at
FROM clients_messages
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_meetings para meetings (se houver)
INSERT INTO meetings (
  id, leads_id, users_id, date, start_time, end_time, location, notes,
  status, attendees, google_meet_link, calendar_id, source, quantity, created_at
)
SELECT 
  id, leads_id, users_id, date, start_time, end_time, location, notes,
  status, attendees, google_meet_link, calendar_id, source, quantity, created_at
FROM clients_meetings
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_files para leads_files (se houver)
INSERT INTO leads_files (
  id, leads_id, users_id, file_name, file_url, file_type, file_size,
  created_at, updated_at
)
SELECT 
  id, leads_id, users_id, file_name, file_url, file_type, file_size,
  created_at, updated_at
FROM clients_files
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_notes para leads_notes (se houver)
INSERT INTO leads_notes (
  id, leads_id, users_id, title, content, created_at, updated_at
)
SELECT 
  id, leads_id, users_id, title, content, created_at, updated_at
FROM clients_notes
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_pipelines para leads_pipelines (se houver)
INSERT INTO leads_pipelines (
  id, name, description, active, created_at, updated_at
)
SELECT 
  id, name, description, active, created_at, updated_at
FROM clients_pipelines
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_stages para leads_stages (se houver)
INSERT INTO leads_stages (
  id, leads_pipelines_id, name, order_index, color, active, created_at, updated_at
)
SELECT 
  id, pipelines_id, name, order_index, color, active, created_at, updated_at
FROM clients_stages
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_stages_followups para leads_stages_followups (se houver)
INSERT INTO leads_stages_followups (
  id, leads_stages_id, type, days, hours, minutes, message, subject,
  audio_file, template_id, active, created_at, updated_at
)
SELECT 
  id, stages_id, type, days, hours, minutes, message, subject,
  audio_file, template_id, active, created_at, updated_at
FROM clients_stages_followups
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_meetings_followups para meetings_followups (se houver)
INSERT INTO meetings_followups (
  id, meeting_status, type, days, hours, minutes, message, subject,
  audio_file, template_id, active, created_at, updated_at
)
SELECT 
  id, meeting_status, type, days, hours, minutes, message, subject,
  audio_file, template_id, active, created_at, updated_at
FROM clients_meetings_followups
ON CONFLICT (id) DO NOTHING;

-- Copiar dados de clients_loss_reasons para leads_loss_reasons (se houver)
INSERT INTO leads_loss_reasons (id, name, created_at, updated_at)
SELECT id, name, created_at, updated_at
FROM clients_loss_reasons
ON CONFLICT (id) DO NOTHING;

-- Fase 2: Dropar tabelas clients_* incorretas

DROP TABLE IF EXISTS clients_loss_reasons CASCADE;
DROP TABLE IF EXISTS clients_meetings_followups CASCADE;
DROP TABLE IF EXISTS clients_stages_followups CASCADE;
DROP TABLE IF EXISTS clients_stages CASCADE;
DROP TABLE IF EXISTS clients_pipelines CASCADE;
DROP TABLE IF EXISTS clients_notes CASCADE;
DROP TABLE IF EXISTS clients_files CASCADE;
DROP TABLE IF EXISTS clients_meetings CASCADE;
DROP TABLE IF EXISTS clients_messages CASCADE;
DROP TABLE IF EXISTS clients_leads CASCADE;

-- Fase 3: Dropar tabelas duplicadas sem prefixo

DROP TABLE IF EXISTS people_companies CASCADE;
DROP TABLE IF EXISTS people CASCADE;
DROP TABLE IF EXISTS companies CASCADE;