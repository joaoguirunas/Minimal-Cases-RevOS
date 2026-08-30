-- =============================================================================
-- POLÍTICAS RLS PARA SEGURANÇA - CORRIGIDA
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
-- ATIVAR RLS NAS TABELAS AUXILIARES
-- =============================================================================

ALTER TABLE public.msg_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistema_buffer_agente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistema_controle_agendamentos ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- POLÍTICAS PARA crm_tenants
-- =============================================================================

-- Super admins podem ver todos os tenants, usuários normais só o seu
CREATE POLICY "tenant_select_policy" ON public.crm_tenants
  FOR SELECT USING (
    public.is_super_admin() OR 
    id = public.get_current_user_tenant_id()
  );

-- Apenas super admins podem inserir/atualizar tenants
CREATE POLICY "tenant_insert_policy" ON public.crm_tenants
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "tenant_update_policy" ON public.crm_tenants
  FOR UPDATE USING (public.is_super_admin());

-- =============================================================================
-- POLÍTICAS PARA crm_usuarios
-- =============================================================================

-- Usuários podem ver outros usuários do mesmo tenant ou se for super admin
CREATE POLICY "usuarios_select_policy" ON public.crm_usuarios
  FOR SELECT USING (
    public.is_super_admin() OR 
    tenant_id = public.get_current_user_tenant_id()
  );

-- Usuários podem inserir apenas no seu tenant (gestores) ou super admins
CREATE POLICY "usuarios_insert_policy" ON public.crm_usuarios
  FOR INSERT WITH CHECK (
    public.is_super_admin() OR 
    (tenant_id = public.get_current_user_tenant_id() AND 
     EXISTS(SELECT 1 FROM public.crm_usuarios WHERE auth_user_id = auth.uid() AND gestor = true))
  );

-- Usuários podem atualizar outros usuários do mesmo tenant (gestores) ou super admins
CREATE POLICY "usuarios_update_policy" ON public.crm_usuarios
  FOR UPDATE USING (
    public.is_super_admin() OR 
    (tenant_id = public.get_current_user_tenant_id() AND 
     EXISTS(SELECT 1 FROM public.crm_usuarios WHERE auth_user_id = auth.uid() AND gestor = true))
  );

-- =============================================================================
-- POLÍTICAS PARA crm_agencias
-- =============================================================================

-- Super admins podem ver todas as agências
CREATE POLICY "agencias_select_policy" ON public.crm_agencias
  FOR SELECT USING (public.is_super_admin());

CREATE POLICY "agencias_insert_policy" ON public.crm_agencias
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "agencias_update_policy" ON public.crm_agencias
  FOR UPDATE USING (public.is_super_admin());

-- =============================================================================
-- POLÍTICAS BASEADAS EM TENANT - TEMPLATE PADRÃO
-- =============================================================================

-- Para todas as tabelas que possuem tenant_id, usar o mesmo padrão:

-- PIPELINES
CREATE POLICY "pipelines_tenant_policy" ON public.crm_pipelines
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- STAGES
CREATE POLICY "stages_tenant_policy" ON public.crm_stages
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- PESSOAS
CREATE POLICY "pessoas_tenant_policy" ON public.crm_pessoas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- EMPRESAS
CREATE POLICY "empresas_tenant_policy" ON public.crm_empresas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- PESSOA_EMPRESAS
CREATE POLICY "pessoa_empresas_tenant_policy" ON public.crm_pessoa_empresas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- LEADS
CREATE POLICY "leads_tenant_policy" ON public.crm_leads
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- MESSAGES
CREATE POLICY "messages_tenant_policy" ON public.crm_messages
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- AGENDAMENTOS
CREATE POLICY "agendamentos_tenant_policy" ON public.crm_agendamentos
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- CAMPANHAS
CREATE POLICY "campanhas_tenant_policy" ON public.crm_campanhas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- CAMPANHA_CONTATOS
CREATE POLICY "campanha_contatos_tenant_policy" ON public.crm_campanha_contatos
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- BASES CONHECIMENTO
CREATE POLICY "basesconhecimento_tenant_policy" ON public.crm_basesconhecimento
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- BASES CONHECIMENTO CHUNKS
CREATE POLICY "basesconhecimento_chunks_tenant_policy" ON public.crm_basesconhecimento_chunks
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- AGENTES IA
CREATE POLICY "agentes_ia_tenant_policy" ON public.crm_agentes_ia
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- AGENTES IA ETAPAS
CREATE POLICY "agentes_ia_etapas_tenant_policy" ON public.crm_agentes_ia_etapas
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.crm_agentes_ia WHERE id = agente_ia_id AND tenant_id = public.get_current_user_tenant_id())
  );

-- AGENTES IA HISTORICO
CREATE POLICY "agentes_ia_historico_tenant_policy" ON public.crm_agentes_ia_historico
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.crm_agentes_ia WHERE id = agente_ia_id AND tenant_id = public.get_current_user_tenant_id())
  );

-- AGENTES IA ETAPAS HISTORICO
CREATE POLICY "agentes_ia_etapas_historico_tenant_policy" ON public.crm_agentes_ia_etapas_historico
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.crm_agentes_ia WHERE id = agente_ia_id AND tenant_id = public.get_current_user_tenant_id())
  );

-- LLM CONNECTIONS
CREATE POLICY "llm_connections_tenant_policy" ON public.crm_llm_connections
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- LLM USAGE LOGS
CREATE POLICY "llm_usage_logs_tenant_policy" ON public.crm_llm_usage_logs
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- CAMPOS PERSONALIZADOS
CREATE POLICY "campos_personalizados_tenant_policy" ON public.crm_campos_personalizados
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- TIMES
CREATE POLICY "times_tenant_policy" ON public.crm_times
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- USUARIO_TIMES
CREATE POLICY "usuario_times_tenant_policy" ON public.crm_usuario_times
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- HORARIOS
CREATE POLICY "horarios_tenant_policy" ON public.crm_horarios
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- STAGE_FOLLOWUPS
CREATE POLICY "stage_followups_tenant_policy" ON public.crm_stage_followups
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- AGENDAMENTOS_FOLLOWUPS
CREATE POLICY "agendamentos_followups_tenant_policy" ON public.crm_agendamentos_followups
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- NEGOCIO_ARQUIVOS
CREATE POLICY "negocio_arquivos_tenant_policy" ON public.crm_negocio_arquivos
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- NEGOCIO_NOTAS
CREATE POLICY "negocio_notas_tenant_policy" ON public.crm_negocio_notas
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- MOTIVO_PERDA
CREATE POLICY "motivo_perda_tenant_policy" ON public.crm_motivo_perda
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- DATABASE_CONNECTIONS
CREATE POLICY "database_connections_tenant_policy" ON public.crm_database_connections
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- SECURITY_AUDIT_LOG
CREATE POLICY "security_audit_log_tenant_policy" ON public.crm_security_audit_log
  FOR ALL USING (tenant_id = public.get_current_user_tenant_id());

-- =============================================================================
-- POLÍTICAS PARA RELACIONAMENTOS AGÊNCIA
-- =============================================================================

-- AGENCIA_TENANTS - Super admins podem ver todos
CREATE POLICY "agencia_tenants_policy" ON public.crm_agencia_tenants
  FOR ALL USING (public.is_super_admin());

-- AGENCIA_USUARIOS - Super admins podem ver todos
CREATE POLICY "agencia_usuarios_policy" ON public.crm_agencia_usuarios
  FOR ALL USING (public.is_super_admin());

-- =============================================================================
-- POLÍTICAS PARA TABELAS AUXILIARES
-- =============================================================================

-- MSG_BUFFER - Todos podem acessar (usado para integração)
CREATE POLICY "msg_buffer_policy" ON public.msg_buffer
  FOR ALL USING (true);

-- N8N_CHAT_HISTORIES - Todos podem acessar (usado para integração)
CREATE POLICY "n8n_chat_histories_policy" ON public.n8n_chat_histories
  FOR ALL USING (true);

-- SISTEMA_BUFFER_AGENTE - Todos podem acessar (usado para integração)
CREATE POLICY "sistema_buffer_agente_policy" ON public.sistema_buffer_agente
  FOR ALL USING (true);

-- SISTEMA_CONTROLE_AGENDAMENTOS - Todos podem acessar (usado para integração)
CREATE POLICY "sistema_controle_agendamentos_policy" ON public.sistema_controle_agendamentos
  FOR ALL USING (true);

-- =============================================================================
-- CORRIGIR FUNÇÃO COM SEARCH_PATH (REMOVER E RECRIAR COM DEPENDÊNCIAS)
-- =============================================================================

-- Primeiro remover o trigger
DROP TRIGGER IF EXISTS trigger_calculate_tokens_total ON public.crm_llm_usage_logs;

-- Depois remover a função
DROP FUNCTION IF EXISTS calculate_tokens_total();

-- Recriar a função com search_path correto
CREATE OR REPLACE FUNCTION calculate_tokens_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tokens_total := COALESCE(NEW.tokens_input, 0) + COALESCE(NEW.tokens_output, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar o trigger
CREATE TRIGGER trigger_calculate_tokens_total
  BEFORE INSERT OR UPDATE ON public.crm_llm_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_tokens_total();