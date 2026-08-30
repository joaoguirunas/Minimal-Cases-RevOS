-- Create RLS policies for crm_stages table to ensure tenant isolation

-- Policy for SELECT: Users can only view stages from their tenant or if they're super admin
CREATE POLICY "Users can view stages from their tenant" 
ON public.crm_stages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

-- Policy for INSERT: Users can create stages in their tenant
CREATE POLICY "Users can insert stages in their tenant" 
ON public.crm_stages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

-- Policy for UPDATE: Users can update stages from their tenant
CREATE POLICY "Users can update stages from their tenant" 
ON public.crm_stages 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

-- Policy for DELETE: Only managers and super admins can delete stages from their tenant
CREATE POLICY "Users can delete stages from their tenant" 
ON public.crm_stages 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_stages.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);