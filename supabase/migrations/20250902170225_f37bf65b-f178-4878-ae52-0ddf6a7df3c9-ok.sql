-- CORREÇÃO COMPLETA DO SISTEMA RLS - RESOLVER PROBLEMA GLOBAL DE ACESSO
-- ========================================================================

-- 1. DROPAR TODAS AS FUNÇÕES PROBLEMÁTICAS QUE CAUSAM RECURSÃO
DROP FUNCTION IF EXISTS public.user_has_tenant_access(uuid);
DROP FUNCTION IF EXISTS public.is_user_super_admin();
DROP FUNCTION IF EXISTS public.is_user_manager_for_tenant(uuid);
DROP FUNCTION IF EXISTS public.get_current_user_tenant_id();
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
DROP FUNCTION IF EXISTS public.is_current_user_super_admin();
DROP FUNCTION IF EXISTS public.get_current_user_tenant_safe();
DROP FUNCTION IF EXISTS public.is_current_user_super_admin_safe();

-- 2. RECRIAR POLÍTICAS RLS SIMPLES SEM DEPENDÊNCIAS CIRCULARES

-- ========================================================================
-- TABELA: crm_agendamentos_followups
-- ========================================================================
DROP POLICY IF EXISTS "Users can create agendamentos followups in their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can delete agendamentos followups of their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can update agendamentos followups of their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can view agendamentos followups of their tenant" ON crm_agendamentos_followups;

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
DROP POLICY IF EXISTS "Users can manage agents from their tenant" ON crm_agentes_ia;

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
-- TABELA: crm_basesconhecimento
-- ========================================================================
DROP POLICY IF EXISTS "Users can view bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can insert bases in their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can update bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can delete bases from their tenant" ON crm_basesconhecimento;

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
DROP POLICY IF EXISTS "Users can view chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can insert chunks in their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can update chunks from their tenant" ON crm_basesconhecimento_chunks;
DROP POLICY IF EXISTS "Users can delete chunks from their tenant" ON crm_basesconhecimento_chunks;

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

-- ========================================================================
-- TABELA: crm_campanha_contatos
-- ========================================================================
DROP POLICY IF EXISTS "Users can view campanha_contatos from their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can insert campanha_contatos in their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can update campanha_contatos from their tenant" ON crm_campanha_contatos;
DROP POLICY IF EXISTS "Users can delete campanha_contatos from their tenant" ON crm_campanha_contatos;

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
DROP POLICY IF EXISTS "Users can view campanhas from their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can insert campanhas in their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can update campanhas from their tenant" ON crm_campanhas;
DROP POLICY IF EXISTS "Users can delete campanhas from their tenant" ON crm_campanhas;

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
-- TABELA: crm_motivo_perda
-- ========================================================================
DROP POLICY IF EXISTS "Users can view motivos from their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can insert motivos in their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can update motivos from their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can delete motivos from their tenant" ON crm_motivo_perda;

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
DROP POLICY IF EXISTS "Users can view notes from their tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Users can insert notes in their tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Users can update notes from their tenant" ON crm_negocio_notas;
DROP POLICY IF EXISTS "Users can delete notes from their tenant" ON crm_negocio_notas;

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
DROP POLICY IF EXISTS "Users can view pessoa_empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can insert pessoa_empresas in their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can update pessoa_empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can delete pessoa_empresas from their tenant" ON crm_pessoa_empresas;

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
DROP POLICY IF EXISTS "Users can view stage followups of their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can create stage followups in their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can update stage followups of their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can delete stage followups of their tenant" ON crm_stage_followups;

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

-- ========================================================================
-- TABELA: crm_llm_usage_logs
-- ========================================================================
DROP POLICY IF EXISTS "Users can view usage logs from their tenant" ON crm_llm_usage_logs;
DROP POLICY IF EXISTS "Users can insert usage logs in their tenant" ON crm_llm_usage_logs;

CREATE POLICY "Users can view llm usage logs from their tenant" ON crm_llm_usage_logs
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

CREATE POLICY "Users can insert llm usage logs in their tenant" ON crm_llm_usage_logs
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