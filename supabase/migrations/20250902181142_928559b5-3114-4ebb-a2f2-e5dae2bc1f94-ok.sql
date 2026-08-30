-- Corrigir políticas RLS para todas as tabelas relacionadas aos agentes de IA

-- 1. Corrigir políticas para crm_agentes_ia_etapas
DROP POLICY IF EXISTS "Users can manage etapas from their tenant agents" ON crm_agentes_ia_etapas;

CREATE POLICY "Users can view etapas from their tenant agents" ON crm_agentes_ia_etapas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    JOIN crm_usuarios u ON (
      u.tenant_id = ai.tenant_id 
      OR u.super_adm = true
    )
    WHERE ai.id = crm_agentes_ia_etapas.agente_ia_id
    AND u.auth_user_id = auth.uid()
    AND u.ativo = true
  )
);

CREATE POLICY "Users can insert etapas in their tenant agents" ON crm_agentes_ia_etapas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    JOIN crm_usuarios u ON (
      u.tenant_id = ai.tenant_id 
      OR u.super_adm = true
    )
    WHERE ai.id = crm_agentes_ia_etapas.agente_ia_id
    AND u.auth_user_id = auth.uid()
    AND u.ativo = true
  )
);

CREATE POLICY "Users can update etapas from their tenant agents" ON crm_agentes_ia_etapas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    JOIN crm_usuarios u ON (
      u.tenant_id = ai.tenant_id 
      OR u.super_adm = true
    )
    WHERE ai.id = crm_agentes_ia_etapas.agente_ia_id
    AND u.auth_user_id = auth.uid()
    AND u.ativo = true
  )
);

CREATE POLICY "Users can delete etapas from their tenant agents" ON crm_agentes_ia_etapas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    JOIN crm_usuarios u ON (
      u.tenant_id = ai.tenant_id 
      OR u.super_adm = true
    )
    WHERE ai.id = crm_agentes_ia_etapas.agente_ia_id
    AND u.auth_user_id = auth.uid()
    AND u.ativo = true
  )
);

-- 2. Corrigir políticas para crm_agentes_ia_historico
DROP POLICY IF EXISTS "Users can view agent history from their tenant" ON crm_agentes_ia_historico;

CREATE POLICY "Users can view agent history from their tenant" ON crm_agentes_ia_historico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    JOIN crm_usuarios u ON (
      u.tenant_id = ai.tenant_id 
      OR u.super_adm = true
    )
    WHERE ai.id = crm_agentes_ia_historico.agente_ia_id
    AND u.auth_user_id = auth.uid()
    AND u.ativo = true
  )
);

-- 3. Corrigir políticas para crm_agentes_ia_etapas_historico
DROP POLICY IF EXISTS "Users can view etapas history from their tenant" ON crm_agentes_ia_etapas_historico;

CREATE POLICY "Users can view etapas history from their tenant" ON crm_agentes_ia_etapas_historico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_agentes_ia ai
    JOIN crm_usuarios u ON (
      u.tenant_id = ai.tenant_id 
      OR u.super_adm = true
    )
    WHERE ai.id = crm_agentes_ia_etapas_historico.agente_ia_id
    AND u.auth_user_id = auth.uid()
    AND u.ativo = true
  )
);