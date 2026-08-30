-- Correção final usando função SECURITY DEFINER para evitar recursão infinita

-- 1. Remover a política problemática que ainda pode causar recursão
DROP POLICY IF EXISTS "crm_usuarios_select_manager" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_delete_managers" ON crm_usuarios;

-- 2. Criar função SECURITY DEFINER para verificar permissões sem recursão
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(user_id uuid, tenant_id uuid, is_gestor boolean, is_super_adm boolean, is_ativo boolean)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, tenant_id, gestor, super_adm, ativo
  FROM crm_usuarios 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- 3. Criar políticas usando a função SECURITY DEFINER
CREATE POLICY "crm_usuarios_select_all_permissions" ON crm_usuarios
FOR SELECT USING (
  -- Usuário pode ver seus próprios dados
  auth_user_id = auth.uid()
  OR
  -- Super admin pode ver todos
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE p.is_super_adm = true AND p.is_ativo = true
  )
  OR
  -- Gestor pode ver usuários do mesmo tenant
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE p.tenant_id = crm_usuarios.tenant_id 
    AND p.is_gestor = true 
    AND p.is_ativo = true
  )
);

-- 4. Política para DELETE usando a função
CREATE POLICY "crm_usuarios_delete_with_permissions" ON crm_usuarios
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE (p.is_gestor = true OR p.is_super_adm = true) 
    AND p.is_ativo = true
  )
);

-- 5. Política para UPDATE mais permissiva
CREATE POLICY "crm_usuarios_update_with_permissions" ON crm_usuarios
FOR UPDATE USING (
  -- Usuário pode atualizar seus próprios dados
  auth_user_id = auth.uid()
  OR
  -- Gestor/admin pode atualizar usuários do tenant
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE (
      (p.tenant_id = crm_usuarios.tenant_id AND p.is_gestor = true)
      OR p.is_super_adm = true
    )
    AND p.is_ativo = true
  )
);