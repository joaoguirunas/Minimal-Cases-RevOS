-- =============================================
-- MIGRAÇÃO DE DADOS E TRIGGERS DE HISTÓRICO
-- =============================================

-- ============= MIGRAÇÃO: TEAMS =============
INSERT INTO teams (id, name, description, type, priority, active, created_at, updated_at)
SELECT id, nome, descricao, tipo::text, prioridade, ativo, created_at, updated_at
FROM crm_times
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: USERS =============
INSERT INTO users (id, auth_user_id, name, email, whatsapp, is_manager, is_super_admin, active, deleted_by, deleted_at, created_at, updated_at)
SELECT id, auth_user_id, nome, email, whatsapp, gestor, COALESCE(super_adm, false), ativo, deleted_by, deleted_at, created_at, updated_at
FROM crm_usuarios
ON CONFLICT (id) DO NOTHING;

INSERT INTO users_teams (id, users_id, teams_id, created_at)
SELECT id, usuario_id, time_id, created_at
FROM crm_usuario_times
ON CONFLICT (id) DO NOTHING;

INSERT INTO users_schedules (id, users_id, weekday, start_time, end_time, active, created_at)
SELECT id, usuario_id, dia_semana, hora_inicio, hora_fim, ativo, created_at
FROM crm_horarios
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: SETTINGS =============
INSERT INTO settings (id, company_name, tax_id, email, phone, address, website, logo_url, language, currency, timezone, primary_color, secondary_color, accent_color, created_at, updated_at)
SELECT id, nome_empresa, cnpj, email, telefone, endereco, website, logo_url, idioma, moeda, fuso_horario, cor_principal, cor_secundaria, cor_destaque, created_at, updated_at
FROM crm_configuracoes_gerais
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: COMPANIES =============
INSERT INTO companies (id, trade_name, legal_name, tax_id, phone, email, website, status, notes, metadata, created_at, updated_at)
SELECT id, nome_fantasia, razao_social, cnpj, telefone, email, site, status, observacoes, COALESCE(empresas_info_json, '{}'), created_at, updated_at
FROM crm_empresas
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: PEOPLE =============
INSERT INTO people (id, name, email, whatsapp, document, source, status, service_status, notes, moment, goal, income, type, score, disc_profile, disc_summary, conversation_summary, summary_message_counter, ai_enabled, accepts_calls, whatsapp_remote_id, external_crm_person_id, metadata, created_at, updated_at)
SELECT id, nome, email, whatsapp, documento, origem, status, status_atendimento, observacoes, momento, objetivo, renda, tipo, score, disc, disc_resumo, resumo_conversa, contador_mensagens_resumo, COALESCE(atendimento_ia, true), COALESCE(aceita_ligacao, true), whatsapp_remote_id, external_crm_person_id, COALESCE(pessoas_info_json, '{}'), created_at, updated_at
FROM crm_pessoas
ON CONFLICT (id) DO NOTHING;

INSERT INTO people_companies (id, people_id, companies_id, created_at, updated_at)
SELECT id, pessoa_id, empresa_id, created_at, updated_at
FROM crm_pessoa_empresas
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: LEADS PIPELINES & STAGES =============
INSERT INTO leads_pipelines (id, name, description, active, created_at, updated_at)
SELECT id, nome, descricao, ativo, created_at, updated_at
FROM crm_pipelines
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads_stages (id, leads_pipelines_id, name, order_index, color, active, created_at, updated_at)
SELECT id, pipeline_id, nome, ordem, cor, ativo, created_at, updated_at
FROM crm_stages
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads_stages_followups (id, leads_stages_id, type, message, subject, template_id, audio_file, days, hours, minutes, active, created_at, updated_at)
SELECT id, stage_id, tipo, mensagem, assunto, template_id, arquivo_audio, dias, horas, minutos, ativo, created_at, updated_at
FROM crm_stage_followups
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: LEADS LOSS REASONS =============
INSERT INTO leads_loss_reasons (id, name, created_at, updated_at)
SELECT id, nome, created_at, updated_at
FROM crm_motivo_perda
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: LEADS =============
INSERT INTO leads (id, people_id, companies_id, leads_pipelines_id, leads_stages_id, users_id, teams_id, leads_loss_reasons_id, title, value, status, control, loss_reason, ai_blocked, ai_blocked_until, last_interaction, last_interaction_at, followup_attempts, followup_status, won_at, external_crm_lead_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, metadata, created_at, updated_at)
SELECT id, person_id, empresa_id, pipeline_id, stage_id, responsavel, time_responsavel, motivo_perda_id, titulo, valor, status, controle, motivo_perda, COALESCE(bloqueia_ia, false), datetime_bloqueia_ia, ultima_interacao, data_ultima_interacao, tentativas_followup, status_followup, data_ganho, external_crm_lead_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, COALESCE(leads_info_json, '{}'), created_at, updated_at
FROM crm_leads
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads_files (id, leads_id, users_id, file_name, file_type, file_size, file_url, created_at, updated_at)
SELECT id, negocio_id, usuario_id, nome_arquivo, tipo_arquivo, tamanho_arquivo, url_arquivo, created_at, updated_at
FROM crm_negocio_arquivos
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads_notes (id, leads_id, users_id, title, content, created_at, updated_at)
SELECT id, negocio_id, usuario_id, titulo, conteudo, created_at, updated_at
FROM crm_negocio_notas
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: MEETINGS =============
INSERT INTO meetings (id, leads_id, users_id, date, start_time, end_time, location, notes, status, source, quantity, attendees, google_meet_link, calendar_id, created_at)
SELECT id, negocio_id, usuario_id, data, hora_inicio, hora_fim, local, observacoes, status, origem, quantidade, convidados, google_meet_link, id_calendar, criado_em
FROM crm_agendamentos
ON CONFLICT (id) DO NOTHING;

INSERT INTO meetings_followups (id, meeting_status, type, message, subject, template_id, audio_file, days, hours, minutes, active, created_at, updated_at)
SELECT id, status_agendamento, tipo, mensagem, assunto, template_id, arquivo_audio, dias, horas, minutos, ativo, created_at, updated_at
FROM crm_agendamentos_followups
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: MESSAGES =============
INSERT INTO messages (id, leads_id, people_id, users_id, followup_id, content, from_contact, channel, message_type, audio_url, audio_duration, transcription, tokens_qty, llm, metadata, created_at, updated_at)
SELECT id, lead_id, pessoa_id, usuario_id, followup_id, message, from_message, canal, tipo_mensagem, audio_url, duracao_audio, transcricao, tokens_qty, llm, COALESCE(conversas_info_json, '{}'), created_at, updated_at
FROM crm_messages
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: CAMPAIGNS =============
INSERT INTO campaigns (id, name, message, channel, status, leads_pipelines_id, leads_stages_id, wait_time, interval_start, interval_end, created_at, updated_at)
SELECT id, nome, mensagem, canal, status, pipeline_id, etapa_id, tempo_espera_envios, intervalo_inicio, intervalo_fim, created_at, updated_at
FROM crm_campanhas
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaigns_contacts (id, campaigns_id, leads_id, name, phone, email, send_status, sent_at, response, created_at, updated_at)
SELECT id, campanha_id, lead_id, nome, telefone, email, status_envio, enviado_em, resposta, created_at, updated_at
FROM crm_campanha_contatos
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: AI AGENTS =============
INSERT INTO ai_agents (id, name, description, leads_pipelines_id, identity, base_prompt, general_rules, input_data, use_stages, current_version, active, created_by, updated_by, created_at, updated_at)
SELECT id, nome, descricao, pipeline_id, identidade, prompt_base, regras_gerais, dados_entrada, usa_etapas, versao_atual, ativo, created_by, updated_by, created_at, updated_at
FROM crm_agentes_ia
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_agents_stages (id, ai_agents_id, leads_pipelines_id, leads_stages_id, stage_name, stage_prompt, order_index, control, active, created_at, updated_at)
SELECT id, agente_ia_id, pipeline_id, stage_id, nome_etapa, prompt_etapa, ordem, controle, ativa, created_at, updated_at
FROM crm_agentes_ia_etapas
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_agents_history (id, ai_agents_id, version, identity, general_rules, base_prompt, input_data, use_stages, changelog, created_by, created_at)
SELECT id, agente_ia_id, versao, identidade, regras_gerais, prompt_base, dados_entrada, usa_etapas, changelog, created_by, created_at
FROM crm_agentes_ia_historico
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_agents_stages_history (id, ai_agents_id, version, stage_name, stage_prompt, order_index, active, created_at)
SELECT id, agente_ia_id, versao, nome_etapa, prompt_etapa, ordem, ativa, created_at
FROM crm_agentes_ia_etapas_historico
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: KNOWLEDGE BASE =============
INSERT INTO knowledge_bases (id, title, description, original_content, file_url, source, created_at, updated_at)
SELECT id, titulo, descricao, conteudo_original, arquivo_url, origem, created_at, updated_at
FROM crm_basesconhecimento
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_bases_chunks (id, knowledge_bases_id, content, chunk_order, embedding, metadata, created_at, updated_at)
SELECT id, base_id, content, ordem_chunk, embedding, metadata, created_at, updated_at
FROM crm_basesconhecimento_chunks
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: LLM =============
INSERT INTO llm_connections (id, provider, default_model, api_key, temperature, max_tokens, active, connection_status, error_message, last_test_at, additional_config, created_by, updated_by, created_at, updated_at)
SELECT id, provider, model_default, api_key, temperature, max_tokens, ativo, status_conexao, mensagem_erro, ultimo_teste, config_adicional, created_by, updated_by, created_at, updated_at
FROM crm_llm_connections
ON CONFLICT (id) DO NOTHING;

INSERT INTO llm_usage_logs (id, llm_connections_id, users_id, feature, provider, model, prompt_preview, tokens_input, tokens_output, tokens_total, estimated_cost, response_time, success, error, created_at)
SELECT id, connection_id, usuario_id, funcionalidade, provider, model, prompt_preview, tokens_input, tokens_output, tokens_total, custo_estimado, tempo_resposta, sucesso, erro, created_at
FROM crm_llm_usage_logs
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: SECURITY =============
INSERT INTO security_audit_logs (id, users_id, action, resource_type, resource_id, ip_address, user_agent, details, created_at)
SELECT id, user_id, action, resource_type, resource_id, ip_address, user_agent, details, created_at
FROM crm_security_audit_log
ON CONFLICT (id) DO NOTHING;

-- ============= MIGRAÇÃO: SYSTEM =============
INSERT INTO system_modules (id, key, name, icon, order_index, active, created_at, updated_at)
SELECT id, module_key, module_name, icon, ordem, ativo, created_at, updated_at
FROM crm_system_modules
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- TRIGGERS DE HISTÓRICO AUTOMÁTICO
-- =============================================

-- TRIGGER: LEADS UPDATES
CREATE OR REPLACE FUNCTION track_leads_changes()
RETURNS TRIGGER AS $$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO leads_updates (
          leads_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          CASE 
            WHEN field_name = 'leads_stages_id' THEN 'stage_change'
            WHEN field_name = 'status' THEN 'status_change'
            ELSE 'update'
          END
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER leads_changes_trigger
AFTER UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION track_leads_changes();

-- TRIGGER: PEOPLE UPDATES
CREATE OR REPLACE FUNCTION track_people_changes()
RETURNS TRIGGER AS $$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO people_updates (
          people_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          'update'
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER people_changes_trigger
AFTER UPDATE ON people
FOR EACH ROW
EXECUTE FUNCTION track_people_changes();

-- TRIGGER: COMPANIES UPDATES
CREATE OR REPLACE FUNCTION track_companies_changes()
RETURNS TRIGGER AS $$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO companies_updates (
          companies_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          'update'
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER companies_changes_trigger
AFTER UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION track_companies_changes();

-- TRIGGER: MEETINGS UPDATES
CREATE OR REPLACE FUNCTION track_meetings_changes()
RETURNS TRIGGER AS $$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO meetings_updates (
          meetings_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          CASE 
            WHEN field_name = 'status' THEN 'status_change'
            ELSE 'update'
          END
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER meetings_changes_trigger
AFTER UPDATE ON meetings
FOR EACH ROW
EXECUTE FUNCTION track_meetings_changes();

-- TRIGGER: CAMPAIGNS UPDATES
CREATE OR REPLACE FUNCTION track_campaigns_changes()
RETURNS TRIGGER AS $$
DECLARE
  field_name text;
  old_val jsonb;
  new_val jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT key 
      FROM jsonb_each(to_jsonb(NEW.*))
      WHERE key NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      old_val := to_jsonb(OLD.*) -> field_name;
      new_val := to_jsonb(NEW.*) -> field_name;
      
      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO campaigns_updates (
          campaigns_id,
          changed_by,
          changed_at,
          field_name,
          old_value,
          new_value,
          change_type
        ) VALUES (
          NEW.id,
          (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1),
          NOW(),
          field_name,
          old_val,
          new_val,
          CASE 
            WHEN field_name = 'status' THEN 'status_change'
            ELSE 'update'
          END
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER campaigns_changes_trigger
AFTER UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION track_campaigns_changes();