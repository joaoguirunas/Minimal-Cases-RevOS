-- Atualizar função user_has_tenant_access para dar acesso global aos super admins
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      super_adm = true OR 
      tenant_id = target_tenant_id
    )
  );
$$;