-- Create RLS policies for crm_pipelines table to ensure tenant isolation

-- Policy for SELECT: Users can only view pipelines from their tenant or if they're super admin
CREATE POLICY "Users can view pipelines from their tenant" 
ON public.crm_pipelines 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

-- Policy for INSERT: Users can create pipelines in their tenant
CREATE POLICY "Users can insert pipelines in their tenant" 
ON public.crm_pipelines 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

-- Policy for UPDATE: Users can update pipelines from their tenant
CREATE POLICY "Users can update pipelines from their tenant" 
ON public.crm_pipelines 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

-- Policy for DELETE: Only managers and super admins can delete pipelines from their tenant
CREATE POLICY "Users can delete pipelines from their tenant" 
ON public.crm_pipelines 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      (crm_usuarios.tenant_id = crm_pipelines.tenant_id) 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
    AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
  )
);