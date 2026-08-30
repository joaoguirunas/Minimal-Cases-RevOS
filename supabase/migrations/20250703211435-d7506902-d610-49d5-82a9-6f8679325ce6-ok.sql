
-- Corrigir as políticas RLS para crm_times
DROP POLICY IF EXISTS "Users can create times in their tenant" ON crm_times;
DROP POLICY IF EXISTS "Users can view times of their tenant" ON crm_times;
DROP POLICY IF EXISTS "Users can update times of their tenant" ON crm_times;
DROP POLICY IF EXISTS "Users can delete times of their tenant" ON crm_times;

-- Criar políticas RLS corretas para crm_times
CREATE POLICY "Users can create times in their tenant" ON crm_times
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_times.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can view times of their tenant" ON crm_times
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_times.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can update times of their tenant" ON crm_times
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_times.tenant_id OR super_adm = true)
  )
);

CREATE POLICY "Users can delete times of their tenant" ON crm_times
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_times.tenant_id OR super_adm = true)
  )
);
