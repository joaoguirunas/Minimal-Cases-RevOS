-- Copiar dados das tabelas sem prefixo para as com prefixo settings_
-- e depois remover as duplicatas

-- 1. Copiar teams → settings_teams (se houver dados novos) com cast de tipo
INSERT INTO settings_teams (id, nome, descricao, tipo, ativo, prioridade, created_at, updated_at)
SELECT id, name, description, type::tipo_time, active, priority, created_at, updated_at
FROM teams
WHERE id NOT IN (SELECT id FROM settings_teams)
ON CONFLICT (id) DO NOTHING;

-- 2. Copiar users → settings_users (se houver dados novos)
INSERT INTO settings_users (id, nome, email, auth_user_id, gestor, super_adm, ativo, whatsapp, created_at, updated_at, deleted_at, deleted_by)
SELECT id, name, email, auth_user_id, is_manager, is_super_admin, active, whatsapp, created_at, updated_at, deleted_at, deleted_by
FROM users
WHERE id NOT IN (SELECT id FROM settings_users)
ON CONFLICT (id) DO NOTHING;

-- 3. Copiar users_schedules → settings_users_schedules (se houver dados novos)
INSERT INTO settings_users_schedules (id, usuario_id, dia_semana, hora_inicio, hora_fim, ativo, created_at)
SELECT id, users_id, weekday, start_time, end_time, active, created_at
FROM users_schedules
WHERE id NOT IN (SELECT id FROM settings_users_schedules)
ON CONFLICT (id) DO NOTHING;

-- 4. Copiar users_teams → settings_users_teams (se houver dados novos)
INSERT INTO settings_users_teams (id, usuario_id, time_id, created_at)
SELECT id, users_id, teams_id, created_at
FROM users_teams
WHERE id NOT IN (SELECT id FROM settings_users_teams)
ON CONFLICT (id) DO NOTHING;

-- 5. Copiar llm_connections → settings_llm_connections (se houver dados novos)
INSERT INTO settings_llm_connections (id, provider, api_key, model_default, temperature, max_tokens, ativo, status_conexao, mensagem_erro, ultimo_teste, config_adicional, created_at, updated_at, created_by, updated_by)
SELECT id, provider, api_key, default_model, temperature, max_tokens, active, connection_status, error_message, last_test_at, additional_config, created_at, updated_at, created_by, updated_by
FROM llm_connections
WHERE id NOT IN (SELECT id FROM settings_llm_connections)
ON CONFLICT (id) DO NOTHING;

-- 6. Copiar llm_usage_logs → settings_llm_usage_logs (se houver dados novos)
INSERT INTO settings_llm_usage_logs (id, provider, model, funcionalidade, tokens_input, tokens_output, tokens_total, custo_estimado, tempo_resposta, sucesso, erro, prompt_preview, connection_id, usuario_id, created_at)
SELECT id, provider, model, feature, tokens_input, tokens_output, tokens_total, estimated_cost, response_time, success, error, prompt_preview, llm_connections_id, users_id, created_at
FROM llm_usage_logs
WHERE id NOT IN (SELECT id FROM settings_llm_usage_logs)
ON CONFLICT (id) DO NOTHING;

-- Remover tabelas duplicadas sem prefixo
DROP TABLE IF EXISTS users_teams CASCADE;
DROP TABLE IF EXISTS users_schedules CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS llm_usage_logs CASCADE;
DROP TABLE IF EXISTS llm_connections CASCADE;