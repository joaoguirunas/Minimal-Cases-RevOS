-- Fix RLS policies for crm_stage_followups table
-- Remove policies that reference auth.users directly

DROP POLICY IF EXISTS "Users can view stage followups from their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can insert stage followups in their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can update stage followups from their tenant" ON crm_stage_followups;
DROP POLICY IF EXISTS "Users can delete stage followups from their tenant" ON crm_stage_followups;

-- Create new policies without auth.users references
CREATE POLICY "Users can view stage followups from their tenant" 
ON crm_stage_followups 
FOR SELECT 
USING (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_stage_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));

CREATE POLICY "Users can insert stage followups in their tenant" 
ON crm_stage_followups 
FOR INSERT 
WITH CHECK (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_stage_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));

CREATE POLICY "Users can update stage followups from their tenant" 
ON crm_stage_followups 
FOR UPDATE 
USING (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_stage_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));

CREATE POLICY "Users can delete stage followups from their tenant" 
ON crm_stage_followups 
FOR DELETE 
USING (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_stage_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));

-- Fix RLS policies for crm_agendamentos_followups table
-- Remove policies that reference auth.users directly

DROP POLICY IF EXISTS "Users can view agendamentos followups from their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can insert agendamentos followups in their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can update agendamentos followups from their tenant" ON crm_agendamentos_followups;
DROP POLICY IF EXISTS "Users can delete agendamentos followups from their tenant" ON crm_agendamentos_followups;

-- Create new policies without auth.users references
CREATE POLICY "Users can view agendamentos followups from their tenant" 
ON crm_agendamentos_followups 
FOR SELECT 
USING (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_agendamentos_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));

CREATE POLICY "Users can insert agendamentos followups in their tenant" 
ON crm_agendamentos_followups 
FOR INSERT 
WITH CHECK (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_agendamentos_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));

CREATE POLICY "Users can update agendamentos followups from their tenant" 
ON crm_agendamentos_followups 
FOR UPDATE 
USING (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_agendamentos_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));

CREATE POLICY "Users can delete agendamentos followups from their tenant" 
ON crm_agendamentos_followups 
FOR DELETE 
USING (EXISTS ( 
  SELECT 1
  FROM crm_usuarios
  WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND ((crm_usuarios.tenant_id = crm_agendamentos_followups.tenant_id) OR (crm_usuarios.super_adm = true)) 
    AND crm_usuarios.ativo = true
));