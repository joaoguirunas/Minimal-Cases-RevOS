-- Corrigir políticas RLS vulneráveis na tabela crm_stage_followups
-- Remover a política atual que permite acesso total (true para tudo)
DROP POLICY IF EXISTS "crm_stage_followups_policy" ON crm_stage_followups;

-- Criar políticas RLS seguras baseadas em tenant_id
CREATE POLICY "Users can view stage followups of their tenant" 
ON crm_stage_followups 
FOR SELECT 
USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can create stage followups in their tenant" 
ON crm_stage_followups 
FOR INSERT 
WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update stage followups of their tenant" 
ON crm_stage_followups 
FOR UPDATE 
USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete stage followups of their tenant" 
ON crm_stage_followups 
FOR DELETE 
USING (user_has_tenant_access(tenant_id));