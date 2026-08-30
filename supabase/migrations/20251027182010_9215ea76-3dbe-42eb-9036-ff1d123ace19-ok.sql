-- Drop política problemática
DROP POLICY IF EXISTS "usuarios_access_policy_gestores" ON public.settings_users;

-- Criar função SECURITY DEFINER para verificar se usuário é gestor ou super_admin
-- Esta função bypassa RLS e evita recursão infinita
CREATE OR REPLACE FUNCTION public.is_gestor_or_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = _user_id
      AND ativo = true
      AND (super_adm = true OR gestor = true)
  )
$$;

-- Criar políticas corretas usando a função SECURITY DEFINER
-- Usuários podem ver seu próprio perfil
CREATE POLICY "usuarios_select_own_profile"
ON public.settings_users
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

-- Gestores e super_admins podem ver todos os usuários
CREATE POLICY "usuarios_select_all_for_gestores"
ON public.settings_users
FOR SELECT
TO authenticated
USING (public.is_gestor_or_super_admin(auth.uid()));

-- Usuários podem atualizar seu próprio perfil (campos básicos)
CREATE POLICY "usuarios_update_own_profile"
ON public.settings_users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Gestores e super_admins podem atualizar qualquer usuário
CREATE POLICY "usuarios_update_all_for_gestores"
ON public.settings_users
FOR UPDATE
TO authenticated
USING (public.is_gestor_or_super_admin(auth.uid()))
WITH CHECK (public.is_gestor_or_super_admin(auth.uid()));

-- Gestores e super_admins podem criar usuários
CREATE POLICY "usuarios_insert_for_gestores"
ON public.settings_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_gestor_or_super_admin(auth.uid()));

-- Gestores e super_admins podem deletar usuários
CREATE POLICY "usuarios_delete_for_gestores"
ON public.settings_users
FOR DELETE
TO authenticated
USING (public.is_gestor_or_super_admin(auth.uid()));

-- Atualizar política de settings_system_modules para usar a nova função
DROP POLICY IF EXISTS "Apenas super_admin pode gerenciar módulos" ON public.settings_system_modules;

CREATE POLICY "super_admin_manage_modules"
ON public.settings_system_modules
FOR ALL
TO authenticated
USING (public.is_gestor_or_super_admin(auth.uid()))
WITH CHECK (public.is_gestor_or_super_admin(auth.uid()));