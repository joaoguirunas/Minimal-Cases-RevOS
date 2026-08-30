-- CORREÇÃO COMPLETA DO SISTEMA RLS - RESOLVER PROBLEMA GLOBAL DE ACESSO 
-- PARTE 3: CONTINUAR CRIANDO POLÍTICAS PARA AS TABELAS RESTANTES
-- ========================================================================

-- ========================================================================
-- TABELA: crm_campanha_contatos
-- ========================================================================
CREATE POLICY "Users can view campanha_contatos from their tenant" ON crm_campanha_contatos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanha_contatos.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert campanha_contatos in their tenant" ON crm_campanha_contatos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanha_contatos.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update campanha_contatos from their tenant" ON crm_campanha_contatos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanha_contatos.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete campanha_contatos from their tenant" ON crm_campanha_contatos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanha_contatos.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_campanhas
-- ========================================================================
CREATE POLICY "Users can view campanhas from their tenant" ON crm_campanhas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanhas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert campanhas in their tenant" ON crm_campanhas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanhas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update campanhas from their tenant" ON crm_campanhas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanhas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete campanhas from their tenant" ON crm_campanhas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_campanhas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_empresas
-- ========================================================================
CREATE POLICY "Users can view companies from their tenant" ON crm_empresas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can create companies in their tenant" ON crm_empresas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update companies from their tenant" ON crm_empresas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Managers can delete companies from their tenant" ON crm_empresas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND tenant_id = crm_empresas.tenant_id 
    AND (gestor = true OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_llm_usage_logs
-- ========================================================================
CREATE POLICY "Users can view usage logs from their tenant" ON crm_llm_usage_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_llm_usage_logs.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert usage logs in their tenant" ON crm_llm_usage_logs
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_llm_usage_logs.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_motivo_perda
-- ========================================================================
CREATE POLICY "Users can view motivos from their tenant" ON crm_motivo_perda
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert motivos in their tenant" ON crm_motivo_perda
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update motivos from their tenant" ON crm_motivo_perda
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete motivos from their tenant" ON crm_motivo_perda
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_negocio_notas
-- ========================================================================
CREATE POLICY "Users can view notes from their tenant" ON crm_negocio_notas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_negocio_notas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert notes in their tenant" ON crm_negocio_notas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_negocio_notas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update notes from their tenant" ON crm_negocio_notas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_negocio_notas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete notes from their tenant" ON crm_negocio_notas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_negocio_notas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_pessoa_empresas
-- ========================================================================
CREATE POLICY "Users can view pessoa_empresas from their tenant" ON crm_pessoa_empresas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_pessoa_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert pessoa_empresas in their tenant" ON crm_pessoa_empresas
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_pessoa_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update pessoa_empresas from their tenant" ON crm_pessoa_empresas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_pessoa_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete pessoa_empresas from their tenant" ON crm_pessoa_empresas
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_pessoa_empresas.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

-- ========================================================================
-- TABELA: crm_stage_followups
-- ========================================================================
CREATE POLICY "Users can view stage followups from their tenant" ON crm_stage_followups
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_stage_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can insert stage followups in their tenant" ON crm_stage_followups
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_stage_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can update stage followups from their tenant" ON crm_stage_followups
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_stage_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);

CREATE POLICY "Users can delete stage followups from their tenant" ON crm_stage_followups
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_stage_followups.tenant_id OR super_adm = true)
    AND ativo = true
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE email IN ('rafaela@iatize.com', 'joao@iatize.com')
  )
);