-- ============================================
-- FASE 1: MIGRAÇÃO DE DADOS CRM → TABELAS NOVAS
-- ============================================

-- 1. Migrar crm_empresas → companies
INSERT INTO public.companies (
  id, trade_name, legal_name, tax_id, phone, email, website, notes, status, metadata, created_at, updated_at
)
SELECT 
  id, nome_fantasia, razao_social, cnpj, telefone, email, site, observacoes, status, empresas_info_json, created_at, updated_at
FROM public.crm_empresas
ON CONFLICT (id) DO NOTHING;

-- 2. Migrar crm_pessoas → people
INSERT INTO public.people (
  id, name, email, whatsapp, document, source, status, service_status, notes, moment, goal, income, type, score, 
  disc_profile, disc_summary, conversation_summary, summary_message_counter, ai_enabled, accepts_calls, 
  whatsapp_remote_id, external_crm_person_id, metadata, created_at, updated_at
)
SELECT 
  id, nome, email, whatsapp, documento, origem, status, status_atendimento, observacoes, momento, objetivo, renda, tipo, score,
  disc, disc_resumo, resumo_conversa, contador_mensagens_resumo, atendimento_ia, aceita_ligacao,
  whatsapp_remote_id, external_crm_person_id, pessoas_info_json, created_at, updated_at
FROM public.crm_pessoas
ON CONFLICT (id) DO NOTHING;

-- 3. Migrar crm_pessoa_empresas → people_companies
INSERT INTO public.people_companies (id, people_id, companies_id, created_at, updated_at)
SELECT id, pessoa_id, empresa_id, created_at, updated_at
FROM public.crm_pessoa_empresas
ON CONFLICT (id) DO NOTHING;

-- 4. Migrar crm_pipelines → leads_pipelines
INSERT INTO public.leads_pipelines (id, name, description, active, created_at, updated_at)
SELECT id, nome, descricao, ativo, created_at, updated_at
FROM public.crm_pipelines
ON CONFLICT (id) DO NOTHING;

-- 5. Migrar crm_stages → leads_stages
INSERT INTO public.leads_stages (id, leads_pipelines_id, name, order_index, color, active, created_at, updated_at)
SELECT id, pipeline_id, nome, ordem, cor, ativo, created_at, updated_at
FROM public.crm_stages
ON CONFLICT (id) DO NOTHING;

-- 6. Migrar crm_leads → leads
INSERT INTO public.leads (
  id, people_id, companies_id, leads_pipelines_id, leads_stages_id, users_id, teams_id, title, value, status, control, 
  loss_reason, leads_loss_reasons_id, created_at, updated_at, won_at, last_interaction_at, followup_attempts, 
  followup_status, ai_blocked, ai_blocked_until, last_interaction, external_crm_lead_id, metadata,
  utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid
)
SELECT 
  id, person_id, empresa_id, pipeline_id, stage_id, responsavel, time_responsavel, titulo, valor, status, controle,
  motivo_perda, motivo_perda_id, data_criacao, updated_at, data_ganho, data_ultima_interacao, tentativas_followup,
  status_followup, bloqueia_ia, datetime_bloqueia_ia, ultima_interacao, external_crm_lead_id, leads_info_json,
  utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid
FROM public.crm_leads
ON CONFLICT (id) DO NOTHING;

-- 7. Migrar crm_messages → messages
INSERT INTO public.messages (
  id, leads_id, people_id, users_id, followup_id, content, from_contact, channel, message_type, 
  audio_url, transcription, audio_duration, llm, tokens_qty, metadata, created_at, updated_at
)
SELECT 
  id, lead_id, pessoa_id, usuario_id, followup_id, message, from_message, canal, tipo_mensagem,
  audio_url, transcricao, duracao_audio, llm, tokens_qty, conversas_info_json, created_at, updated_at
FROM public.crm_messages
ON CONFLICT (id) DO NOTHING;

-- 8. Migrar crm_agendamentos → meetings
INSERT INTO public.meetings (
  id, leads_id, users_id, date, start_time, end_time, notes, status, source, location, quantity, 
  attendees, google_meet_link, calendar_id, created_at
)
SELECT 
  id, negocio_id, usuario_id, data, hora_inicio, hora_fim, observacoes, status, origem, local, quantidade,
  convidados, google_meet_link, id_calendar, criado_em
FROM public.crm_agendamentos
ON CONFLICT (id) DO NOTHING;

-- 9. Migrar crm_negocio_arquivos → leads_files
INSERT INTO public.leads_files (
  id, leads_id, users_id, file_name, file_url, file_type, file_size, created_at, updated_at
)
SELECT 
  id, negocio_id, usuario_id, nome_arquivo, url_arquivo, tipo_arquivo, tamanho_arquivo, created_at, updated_at
FROM public.crm_negocio_arquivos
ON CONFLICT (id) DO NOTHING;

-- 10. Migrar crm_negocio_notas → leads_notes
INSERT INTO public.leads_notes (id, leads_id, users_id, title, content, created_at, updated_at)
SELECT id, negocio_id, usuario_id, titulo, conteudo, created_at, updated_at
FROM public.crm_negocio_notas
ON CONFLICT (id) DO NOTHING;

-- 11. Migrar crm_security_audit_log → security_audit_logs
INSERT INTO public.security_audit_logs (
  id, users_id, resource_type, resource_id, action, ip_address, user_agent, details, created_at
)
SELECT 
  id, user_id, resource_type, resource_id, action, ip_address, user_agent, details, created_at
FROM public.crm_security_audit_log
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FASE 2: REMOVER TABELAS CRM ANTIGAS
-- ============================================

DROP TABLE IF EXISTS public.crm_messages CASCADE;
DROP TABLE IF EXISTS public.crm_agendamentos CASCADE;
DROP TABLE IF EXISTS public.crm_negocio_arquivos CASCADE;
DROP TABLE IF EXISTS public.crm_negocio_notas CASCADE;
DROP TABLE IF EXISTS public.crm_leads CASCADE;
DROP TABLE IF EXISTS public.crm_stages CASCADE;
DROP TABLE IF EXISTS public.crm_pipelines CASCADE;
DROP TABLE IF EXISTS public.crm_pessoa_empresas CASCADE;
DROP TABLE IF EXISTS public.crm_pessoas CASCADE;
DROP TABLE IF EXISTS public.crm_empresas CASCADE;
DROP TABLE IF EXISTS public.crm_security_audit_log CASCADE;