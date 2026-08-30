-- MIGRAÇÃO PARA SISTEMA SINGLE-TENANT - VERSÃO CORRIGIDA
-- Preservando dados da "Receita Previsível" e removendo estrutura multi-tenant

-- 1. PRIMEIRO: DROPAR TODAS AS POLÍTICAS RLS QUE DEPENDEM DE TENANT_ID
DROP POLICY IF EXISTS "agendamentos_access_policy" ON crm_agendamentos;
DROP POLICY IF EXISTS "agendamentos_followups_access_policy" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "agentes_ia_access_policy" ON crm_agentes_ia;
DROP POLICY IF EXISTS "agentes_ia_etapas_access_policy" ON crm_agentes_ia_etapas;
DROP POLICY IF EXISTS "agentes_ia_etapas_historico_access_policy" ON crm_agentes_ia_etapas_historico;
DROP POLICY IF EXISTS "agentes_ia_historico_access_policy" ON crm_agentes_ia_historico;
DROP POLICY IF EXISTS "basesconhecimento_access_policy" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "basesconhecimento_chunks_access_policy" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "campanha_contatos_access_policy" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "campanhas_access_policy" ON crm_campanhas;
DROP POLICY IF EXISTS "campos_personalizados_access_policy" ON crm_campos_personalizados;
DROP POLICY IF EXISTS "database_connections_access_policy" ON crm_database_connections;
DROP POLICY IF EXISTS "empresas_access_policy" ON crm_empresas;
DROP POLICY IF EXISTS "horarios_access_policy" ON crm_horarios;
DROP POLICY IF EXISTS "leads_access_policy" ON crm_leads;
DROP POLICY IF EXISTS "llm_connections_access_policy" ON crm_llm_connections;
DROP POLICY IF EXISTS "llm_usage_logs_access_policy" ON crm_llm_usage_logs;
DROP POLICY IF EXISTS "messages_access_policy" ON crm_messages;
DROP POLICY IF EXISTS "motivo_perda_access_policy" ON crm_motivo_perda;
DROP POLICY IF EXISTS "negocio_arquivos_access_policy" ON crm_negocio_arquivos;
DROP POLICY IF EXISTS "negocio_notas_access_policy" ON crm_negocio_notas;
DROP POLICY IF EXISTS "pessoa_empresas_access_policy" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "pessoas_access_policy" ON crm_pessoas;
DROP POLICY IF EXISTS "pipelines_access_policy" ON crm_pipelines;
DROP POLICY IF EXISTS "security_audit_log_access_policy" ON crm_security_audit_log;
DROP POLICY IF EXISTS "stage_followups_access_policy" ON crm_stage_followups;
DROP POLICY IF EXISTS "stages_access_policy" ON crm_stages;
DROP POLICY IF EXISTS "times_access_policy" ON crm_times;
DROP POLICY IF EXISTS "usuario_times_access_policy" ON crm_usuario_times;
DROP POLICY IF EXISTS "usuarios_access_existing" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_insert_own_profile" ON crm_usuarios;

-- 2. REMOVER DADOS DE OUTROS TENANTS E MANTER APENAS "RECEITA PREVISÍVEL"
DELETE FROM crm_agendamentos WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_agendamentos_followups WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_agentes_ia WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_basesconhecimento WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_basesconhecimento_chunks WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_campanha_contatos WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_campanhas WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_campos_personalizados WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_database_connections WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_empresas WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_horarios WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_leads WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_llm_connections WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_llm_usage_logs WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_messages WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_motivo_perda WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_negocio_arquivos WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_negocio_notas WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_pessoa_empresas WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_pessoas WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_pipelines WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_security_audit_log WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_stage_followups WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_stages WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_times WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_usuario_times WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');
DELETE FROM crm_usuarios WHERE tenant_id != (SELECT id FROM crm_tenants WHERE value = 'receita-previsivel');

-- 3. AGORA DROPAR AS COLUNAS TENANT_ID (SEM DEPENDÊNCIAS)
ALTER TABLE crm_agendamentos DROP COLUMN tenant_id;
ALTER TABLE crm_agendamentos_followups DROP COLUMN tenant_id;
ALTER TABLE crm_agentes_ia DROP COLUMN tenant_id;
ALTER TABLE crm_basesconhecimento DROP COLUMN tenant_id;
ALTER TABLE crm_basesconhecimento_chunks DROP COLUMN tenant_id;
ALTER TABLE crm_campanha_contatos DROP COLUMN tenant_id;
ALTER TABLE crm_campanhas DROP COLUMN tenant_id;
ALTER TABLE crm_campos_personalizados DROP COLUMN tenant_id;
ALTER TABLE crm_database_connections DROP COLUMN tenant_id;
ALTER TABLE crm_empresas DROP COLUMN tenant_id;
ALTER TABLE crm_horarios DROP COLUMN tenant_id;
ALTER TABLE crm_leads DROP COLUMN tenant_id;
ALTER TABLE crm_llm_connections DROP COLUMN tenant_id;
ALTER TABLE crm_llm_usage_logs DROP COLUMN tenant_id;
ALTER TABLE crm_messages DROP COLUMN tenant_id;
ALTER TABLE crm_motivo_perda DROP COLUMN tenant_id;
ALTER TABLE crm_negocio_arquivos DROP COLUMN tenant_id;
ALTER TABLE crm_negocio_notas DROP COLUMN tenant_id;
ALTER TABLE crm_pessoa_empresas DROP COLUMN tenant_id;
ALTER TABLE crm_pessoas DROP COLUMN tenant_id;
ALTER TABLE crm_pipelines DROP COLUMN tenant_id;
ALTER TABLE crm_security_audit_log DROP COLUMN tenant_id;
ALTER TABLE crm_stage_followups DROP COLUMN tenant_id;
ALTER TABLE crm_stages DROP COLUMN tenant_id;
ALTER TABLE crm_times DROP COLUMN tenant_id;
ALTER TABLE crm_usuario_times DROP COLUMN tenant_id;

-- Simplificar tabela crm_usuarios
ALTER TABLE crm_usuarios DROP COLUMN tenant_id;
ALTER TABLE crm_usuarios DROP COLUMN agencia_id;

-- 4. REMOVER TABELAS DE TENANCY
DROP TABLE IF EXISTS crm_agencia_usuarios;
DROP TABLE IF EXISTS crm_agencia_tenants;
DROP TABLE IF EXISTS crm_agencias;
DROP TABLE IF EXISTS crm_tenants;

-- 5. REMOVER FUNÇÕES RELACIONADAS A TENANT E RECRIAR is_super_admin
DROP FUNCTION IF EXISTS get_current_user_tenant_id();
DROP FUNCTION IF EXISTS get_user_available_tenants();
DROP FUNCTION IF EXISTS is_super_admin();

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(super_adm, false) FROM public.crm_usuarios WHERE auth_user_id = auth.uid();
$$;

-- 6. RECRIAR POLÍTICAS RLS SIMPLIFICADAS
CREATE POLICY "agendamentos_access_policy" ON crm_agendamentos FOR ALL USING (true);
CREATE POLICY "agendamentos_followups_access_policy" ON crm_agendamentos_followups FOR ALL USING (true);
CREATE POLICY "agentes_ia_access_policy" ON crm_agentes_ia FOR ALL USING (true);
CREATE POLICY "agentes_ia_etapas_access_policy" ON crm_agentes_ia_etapas FOR ALL USING (true);
CREATE POLICY "agentes_ia_etapas_historico_access_policy" ON crm_agentes_ia_etapas_historico FOR ALL USING (true);
CREATE POLICY "agentes_ia_historico_access_policy" ON crm_agentes_ia_historico FOR ALL USING (true);
CREATE POLICY "basesconhecimento_access_policy" ON crm_basesconhecimento FOR ALL USING (true);
CREATE POLICY "basesconhecimento_chunks_access_policy" ON crm_basesconhecimento_chunks FOR ALL USING (true);
CREATE POLICY "campanha_contatos_access_policy" ON crm_campanha_contatos FOR ALL USING (true);
CREATE POLICY "campanhas_access_policy" ON crm_campanhas FOR ALL USING (true);
CREATE POLICY "campos_personalizados_access_policy" ON crm_campos_personalizados FOR ALL USING (true);
CREATE POLICY "database_connections_access_policy" ON crm_database_connections FOR ALL USING (true);
CREATE POLICY "empresas_access_policy" ON crm_empresas FOR ALL USING (true);
CREATE POLICY "horarios_access_policy" ON crm_horarios FOR ALL USING (true);
CREATE POLICY "leads_access_policy" ON crm_leads FOR ALL USING (true);
CREATE POLICY "llm_connections_access_policy" ON crm_llm_connections FOR ALL USING (true);
CREATE POLICY "llm_usage_logs_access_policy" ON crm_llm_usage_logs FOR ALL USING (true);
CREATE POLICY "messages_access_policy" ON crm_messages FOR ALL USING (true);
CREATE POLICY "motivo_perda_access_policy" ON crm_motivo_perda FOR ALL USING (true);
CREATE POLICY "negocio_arquivos_access_policy" ON crm_negocio_arquivos FOR ALL USING (true);
CREATE POLICY "negocio_notas_access_policy" ON crm_negocio_notas FOR ALL USING (true);
CREATE POLICY "pessoa_empresas_access_policy" ON crm_pessoa_empresas FOR ALL USING (true);
CREATE POLICY "pessoas_access_policy" ON crm_pessoas FOR ALL USING (true);
CREATE POLICY "pipelines_access_policy" ON crm_pipelines FOR ALL USING (true);
CREATE POLICY "security_audit_log_access_policy" ON crm_security_audit_log FOR ALL USING (true);
CREATE POLICY "stage_followups_access_policy" ON crm_stage_followups FOR ALL USING (true);
CREATE POLICY "stages_access_policy" ON crm_stages FOR ALL USING (true);
CREATE POLICY "times_access_policy" ON crm_times FOR ALL USING (true);
CREATE POLICY "usuario_times_access_policy" ON crm_usuario_times FOR ALL USING (true);
CREATE POLICY "usuarios_access_policy" ON crm_usuarios FOR ALL USING ((auth.uid() = auth_user_id) OR is_super_admin());
CREATE POLICY "usuarios_insert_policy" ON crm_usuarios FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- 7. CONFIRMAÇÃO DOS DADOS PRESERVADOS
SELECT 
    'MIGRAÇÃO CONCLUÍDA - DADOS PRESERVADOS' as status,
    (SELECT COUNT(*) FROM crm_usuarios) as usuarios,
    (SELECT COUNT(*) FROM crm_pessoas) as pessoas,
    (SELECT COUNT(*) FROM crm_empresas) as empresas,
    (SELECT COUNT(*) FROM crm_leads) as leads,
    (SELECT COUNT(*) FROM crm_messages) as mensagens,
    (SELECT COUNT(*) FROM crm_pipelines) as pipelines,
    (SELECT COUNT(*) FROM crm_stages) as stages;