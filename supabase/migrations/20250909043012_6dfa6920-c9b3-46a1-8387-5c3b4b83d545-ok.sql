-- Fix RLS policies for crm_basesconhecimento table
-- Remove all existing policies first
DROP POLICY IF EXISTS "Users can view bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can insert bases in their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can update bases from their tenant" ON crm_basesconhecimento;
DROP POLICY IF EXISTS "Users can delete bases from their tenant" ON crm_basesconhecimento;

-- Create new simplified policies that only check crm_usuarios
CREATE POLICY "Users can view bases from their tenant" ON crm_basesconhecimento
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM crm_usuarios
      WHERE crm_usuarios.auth_user_id = auth.uid()
      AND ((crm_usuarios.tenant_id = crm_basesconhecimento.tenant_id) OR (crm_usuarios.super_adm = true))
      AND crm_usuarios.ativo = true
    )
  );

CREATE POLICY "Users can insert bases in their tenant" ON crm_basesconhecimento
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_usuarios
      WHERE crm_usuarios.auth_user_id = auth.uid()
      AND ((crm_usuarios.tenant_id = crm_basesconhecimento.tenant_id) OR (crm_usuarios.super_adm = true))
      AND crm_usuarios.ativo = true
    )
  );

CREATE POLICY "Users can update bases from their tenant" ON crm_basesconhecimento
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM crm_usuarios
      WHERE crm_usuarios.auth_user_id = auth.uid()
      AND ((crm_usuarios.tenant_id = crm_basesconhecimento.tenant_id) OR (crm_usuarios.super_adm = true))
      AND crm_usuarios.ativo = true
    )
  );

CREATE POLICY "Users can delete bases from their tenant" ON crm_basesconhecimento
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM crm_usuarios
      WHERE crm_usuarios.auth_user_id = auth.uid()
      AND ((crm_usuarios.tenant_id = crm_basesconhecimento.tenant_id) OR (crm_usuarios.super_adm = true))
      AND crm_usuarios.ativo = true
    )
  );