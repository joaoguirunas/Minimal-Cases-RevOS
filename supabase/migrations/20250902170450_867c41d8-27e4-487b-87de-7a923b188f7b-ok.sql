-- CORREÇÃO COMPLETA DO SISTEMA RLS - RESOLVER PROBLEMA GLOBAL DE ACESSO 
-- PARTE 2: RECRIAR TODAS AS POLÍTICAS RLS SEM DEPENDÊNCIAS CIRCULARES
-- ========================================================================

-- ========================================================================
-- TABELA: crm_tenants - RECRIAR POLÍTICAS BÁSICAS
-- ========================================================================
CREATE POLICY "Tenants can be viewed by their users or super admins" ON crm_tenants
FOR SELECT USING (
  id IN (
    SELECT tenant_id FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND ativo = true
  )
  OR EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Tenants can be updated by managers or super admins" ON crm_tenants
FOR UPDATE USING (
  (id IN (
    SELECT tenant_id FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND gestor = true AND ativo = true
  ))
  OR EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Tenants can be created by super admins only" ON crm_tenants
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Tenants can be deleted by super admins only" ON crm_tenants
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() AND super_adm = true AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_agendamentos_followups
-- ========================================================================
CREATE POLICY "Users can view agendamentos followups from their tenant" ON crm_agendamentos_followups
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert agendamentos followups in their tenant" ON crm_agendamentos_followups
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update agendamentos followups from their tenant" ON crm_agendamentos_followups
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete agendamentos followups from their tenant" ON crm_agendamentos_followups
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agendamentos_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_agentes_ia
-- ========================================================================
CREATE POLICY "Users can view agents from their tenant" ON crm_agentes_ia
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agentes_ia.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert agents in their tenant" ON crm_agentes_ia
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agentes_ia.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update agents from their tenant" ON crm_agentes_ia
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agentes_ia.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete agents from their tenant" ON crm_agentes_ia
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_agentes_ia.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_agentes_ia_historico
-- ========================================================================
CREATE POLICY "Users can view agent history from their tenant" ON crm_agentes_ia_historico
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    INNER JOIN crm_usuarios u ON u.tenant_id = ai.tenant_id OR u.super_adm = true
    WHERE ai.id = crm_agentes_ia_historico.agente_ia_id 
    AND u.auth_user_id = auth.uid() 
    AND u.ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_agentes_ia_etapas
-- ========================================================================
CREATE POLICY "Users can manage etapas from their tenant agents" ON crm_agentes_ia_etapas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    INNER JOIN crm_usuarios u ON u.tenant_id = ai.tenant_id OR u.super_adm = true
    WHERE ai.id = crm_agentes_ia_etapas.agente_ia_id 
    AND u.auth_user_id = auth.uid() 
    AND u.ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_agentes_ia_etapas_historico
-- ========================================================================
CREATE POLICY "Users can view etapas history from their tenant" ON crm_agentes_ia_etapas_historico
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    INNER JOIN crm_usuarios u ON u.tenant_id = ai.tenant_id OR u.super_adm = true
    WHERE ai.id = crm_agentes_ia_etapas_historico.agente_ia_id 
    AND u.auth_user_id = auth.uid() 
    AND u.ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_basesconhecimento
-- ========================================================================
CREATE POLICY "Users can view bases from their tenant" ON crm_basesconhecimento
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert bases in their tenant" ON crm_basesconhecimento
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update bases from their tenant" ON crm_basesconhecimento
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete bases from their tenant" ON crm_basesconhecimento
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_basesconhecimento_chunks
-- ========================================================================
CREATE POLICY "Users can view chunks from their tenant" ON crm_basesconhecimento_chunks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert chunks in their tenant" ON crm_basesconhecimento_chunks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update chunks from their tenant" ON crm_basesconhecimento_chunks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete chunks from their tenant" ON crm_basesconhecimento_chunks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_basesconhecimento_chunks.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);