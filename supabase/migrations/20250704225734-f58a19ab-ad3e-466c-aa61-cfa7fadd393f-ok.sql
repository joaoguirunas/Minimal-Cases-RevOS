
-- Atualizar política RLS para permitir inserções na tabela crm_usuario_times
DROP POLICY IF EXISTS "Users can create user_times in their tenant" ON public.crm_usuario_times;

CREATE POLICY "Users can create user_times in their tenant" 
ON public.crm_usuario_times 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_usuario_times.tenant_id OR super_adm = true)
  )
);

-- Também vamos atualizar a política de SELECT para usar a mesma lógica
DROP POLICY IF EXISTS "Users can view user_times of their tenant" ON public.crm_usuario_times;

CREATE POLICY "Users can view user_times of their tenant" 
ON public.crm_usuario_times 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_usuario_times.tenant_id OR super_adm = true)
  )
);

-- E a política de DELETE também
DROP POLICY IF EXISTS "Users can delete user_times of their tenant" ON public.crm_usuario_times;

CREATE POLICY "Users can delete user_times of their tenant" 
ON public.crm_usuario_times 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (tenant_id = crm_usuario_times.tenant_id OR super_adm = true)
  )
);
