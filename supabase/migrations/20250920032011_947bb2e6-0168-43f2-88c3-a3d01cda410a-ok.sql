-- =============================================================================
-- POLÍTICAS RLS PARA SEGURANÇA - VERSÃO LIMPA
-- =============================================================================

-- =============================================================================
-- FUNÇÃO AUXILIAR PARA OBTER TENANT DO USUÁRIO LOGADO  
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.crm_usuarios WHERE auth_user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- =============================================================================
-- FUNÇÃO AUXILIAR PARA VERIFICAR SE É SUPER ADMIN
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(super_adm, false) FROM public.crm_usuarios WHERE auth_user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- =============================================================================
-- REMOVER POLÍTICAS EXISTENTES SE HOUVER
-- =============================================================================

-- CRM_TENANTS
DROP POLICY IF EXISTS "tenant_select_policy" ON public.crm_tenants;
DROP POLICY IF EXISTS "tenant_insert_policy" ON public.crm_tenants;
DROP POLICY IF EXISTS "tenant_update_policy" ON public.crm_tenants;

-- CRM_USUARIOS  
DROP POLICY IF EXISTS "usuarios_select_policy" ON public.crm_usuarios;
DROP POLICY IF EXISTS "usuarios_insert_policy" ON public.crm_usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON public.crm_usuarios;

-- CRM_AGENCIAS
DROP POLICY IF EXISTS "agencias_select_policy" ON public.crm_agencias;
DROP POLICY IF EXISTS "agencias_insert_policy" ON public.crm_agencias;
DROP POLICY IF EXISTS "agencias_update_policy" ON public.crm_agencias;

-- POLÍTICAS TENANT BASEADAS
DROP POLICY IF EXISTS "pipelines_tenant_policy" ON public.crm_pipelines;
DROP POLICY IF EXISTS "stages_tenant_policy" ON public.crm_stages;
DROP POLICY IF EXISTS "pessoas_tenant_policy" ON public.crm_pessoas;
DROP POLICY IF EXISTS "empresas_tenant_policy" ON public.crm_empresas;
DROP POLICY IF EXISTS "pessoa_empresas_tenant_policy" ON public.crm_pessoa_empresas;
DROP POLICY IF EXISTS "leads_tenant_policy" ON public.crm_leads;
DROP POLICY IF EXISTS "messages_tenant_policy" ON public.crm_messages;
DROP POLICY IF EXISTS "agendamentos_tenant_policy" ON public.crm_agendamentos;
DROP POLICY IF EXISTS "campanhas_tenant_policy" ON public.crm_campanhas;
DROP POLICY IF EXISTS "campanha_contatos_tenant_policy" ON public.crm_campanha_contatos;
DROP POLICY IF EXISTS "basesconhecimento_tenant_policy" ON public.crm_basesconhecimento;
DROP POLICY IF EXISTS "basesconhecimento_chunks_tenant_policy" ON public.crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "agentes_ia_tenant_policy" ON public.crm_agentes_ia;
DROP POLICY IF EXISTS "agentes_ia_etapas_tenant_policy" ON public.crm_agentes_ia_etapas;
DROP POLICY IF EXISTS "agentes_ia_historico_tenant_policy" ON public.crm_agentes_ia_historico;
DROP POLICY IF EXISTS "agentes_ia_etapas_historico_tenant_policy" ON public.crm_agentes_ia_etapas_historico;
DROP POLICY IF EXISTS "llm_connections_tenant_policy" ON public.crm_llm_connections;
DROP POLICY IF EXISTS "llm_usage_logs_tenant_policy" ON public.crm_llm_usage_logs;
DROP POLICY IF EXISTS "campos_personalizados_tenant_policy" ON public.crm_campos_personalizados;
DROP POLICY IF EXISTS "times_tenant_policy" ON public.crm_times;
DROP POLICY IF EXISTS "usuario_times_tenant_policy" ON public.crm_usuario_times;
DROP POLICY IF EXISTS "horarios_tenant_policy" ON public.crm_horarios;
DROP POLICY IF EXISTS "stage_followups_tenant_policy" ON public.crm_stage_followups;
DROP POLICY IF EXISTS "agendamentos_followups_tenant_policy" ON public.crm_agendamentos_followups;
DROP POLICY IF EXISTS "negocio_arquivos_tenant_policy" ON public.crm_negocio_arquivos;
DROP POLICY IF EXISTS "negocio_notas_tenant_policy" ON public.crm_negocio_notas;
DROP POLICY IF EXISTS "motivo_perda_tenant_policy" ON public.crm_motivo_perda;
DROP POLICY IF EXISTS "database_connections_tenant_policy" ON public.crm_database_connections;
DROP POLICY IF EXISTS "security_audit_log_tenant_policy" ON public.crm_security_audit_log;

-- RELACIONAMENTOS AGÊNCIA
DROP POLICY IF EXISTS "agencia_tenants_policy" ON public.crm_agencia_tenants;
DROP POLICY IF EXISTS "agencia_usuarios_policy" ON public.crm_agencia_usuarios;

-- TABELAS AUXILIARES
DROP POLICY IF EXISTS "msg_buffer_policy" ON public.msg_buffer;
DROP POLICY IF EXISTS "n8n_chat_histories_policy" ON public.n8n_chat_histories;
DROP POLICY IF EXISTS "sistema_buffer_agente_policy" ON public.sistema_buffer_agente;
DROP POLICY IF EXISTS "sistema_controle_agendamentos_policy" ON public.sistema_controle_agendamentos;

-- =============================================================================
-- ATIVAR RLS NAS TABELAS AUXILIARES QUE PRECISAM
-- =============================================================================

ALTER TABLE public.msg_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistema_buffer_agente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistema_controle_agendamentos ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CRIAR TODAS AS POLÍTICAS RLS
-- =============================================================================

-- TENANTS
CREATE POLICY "tenant_access_policy" ON public.crm_tenants
  FOR ALL USING (
    public.is_super_admin() OR 
    id = public.get_current_user_tenant_id()
  );

-- USUARIOS
CREATE POLICY "usuarios_access_policy" ON public.crm_usuarios
  FOR ALL USING (
    public.is_super_admin() OR 
    tenant_id = public.get_current_user_tenant_id()
  );

-- AGENCIAS - Apenas super admins
CREATE POLICY "agencias_access_policy" ON public.crm_agencias
  FOR ALL USING (public.is_super_admin());

-- AGENCIA_TENANTS - Apenas super admins
CREATE POLICY "agencia_tenants_access_policy" ON public.crm_agencia_tenants
  FOR ALL USING (public.is_super_admin());

-- AGENCIA_USUARIOS - Apenas super admins  
CREATE POLICY "agencia_usuarios_access_policy" ON public.crm_agencia_usuarios
  FOR ALL USING (public.is_super_admin());

-- TODAS AS TABELAS COM TENANT_ID - Política unificada
CREATE POLICY "pipelines_access_policy" ON public.crm_pipelines
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "stages_access_policy" ON public.crm_stages
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "pessoas_access_policy" ON public.crm_pessoas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "empresas_access_policy" ON public.crm_empresas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "pessoa_empresas_access_policy" ON public.crm_pessoa_empresas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "leads_access_policy" ON public.crm_leads
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "messages_access_policy" ON public.crm_messages
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "agendamentos_access_policy" ON public.crm_agendamentos
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "campanhas_access_policy" ON public.crm_campanhas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "campanha_contatos_access_policy" ON public.crm_campanha_contatos
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "basesconhecimento_access_policy" ON public.crm_basesconhecimento
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "basesconhecimento_chunks_access_policy" ON public.crm_basesconhecimento_chunks
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "agentes_ia_access_policy" ON public.crm_agentes_ia
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "agentes_ia_etapas_access_policy" ON public.crm_agentes_ia_etapas
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.crm_agentes_ia WHERE id = agente_ia_id AND tenant_id = public.get_current_user_tenant_id())
  );

CREATE POLICY "agentes_ia_historico_access_policy" ON public.crm_agentes_ia_historico
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.crm_agentes_ia WHERE id = agente_ia_id AND tenant_id = public.get_current_user_tenant_id())
  );

CREATE POLICY "agentes_ia_etapas_historico_access_policy" ON public.crm_agentes_ia_etapas_historico
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.crm_agentes_ia WHERE id = agente_ia_id AND tenant_id = public.get_current_user_tenant_id())
  );

CREATE POLICY "llm_connections_access_policy" ON public.crm_llm_connections
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "llm_usage_logs_access_policy" ON public.crm_llm_usage_logs
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "campos_personalizados_access_policy" ON public.crm_campos_personalizados
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "times_access_policy" ON public.crm_times
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "usuario_times_access_policy" ON public.crm_usuario_times
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "horarios_access_policy" ON public.crm_horarios
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "stage_followups_access_policy" ON public.crm_stage_followups
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "agendamentos_followups_access_policy" ON public.crm_agendamentos_followups
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "negocio_arquivos_access_policy" ON public.crm_negocio_arquivos
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "negocio_notas_access_policy" ON public.crm_negocio_notas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "motivo_perda_access_policy" ON public.crm_motivo_perda
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "database_connections_access_policy" ON public.crm_database_connections
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "security_audit_log_access_policy" ON public.crm_security_audit_log
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- TABELAS AUXILIARES - Acesso aberto para integração
CREATE POLICY "msg_buffer_access_policy" ON public.msg_buffer
  FOR ALL USING (true);

CREATE POLICY "n8n_chat_histories_access_policy" ON public.n8n_chat_histories
  FOR ALL USING (true);

CREATE POLICY "sistema_buffer_agente_access_policy" ON public.sistema_buffer_agente
  FOR ALL USING (true);

CREATE POLICY "sistema_controle_agendamentos_access_policy" ON public.sistema_controle_agendamentos
  FOR ALL USING (true);