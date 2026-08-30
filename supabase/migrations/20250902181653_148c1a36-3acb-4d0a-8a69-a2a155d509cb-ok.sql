-- Corrigir políticas RLS para crm_motivo_perda

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Users can delete motivos from their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can insert motivos in their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can update motivos from their tenant" ON crm_motivo_perda;
DROP POLICY IF EXISTS "Users can view motivos from their tenant" ON crm_motivo_perda;

-- Criar políticas corretas
CREATE POLICY "Users can view motivos from their tenant" ON crm_motivo_perda
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can insert motivos in their tenant" ON crm_motivo_perda
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can update motivos from their tenant" ON crm_motivo_perda
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
  )
);

CREATE POLICY "Users can delete motivos from their tenant" ON crm_motivo_perda
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios
    WHERE auth_user_id = auth.uid()
    AND (tenant_id = crm_motivo_perda.tenant_id OR super_adm = true)
    AND ativo = true
    AND (gestor = true OR super_adm = true)
  )
);