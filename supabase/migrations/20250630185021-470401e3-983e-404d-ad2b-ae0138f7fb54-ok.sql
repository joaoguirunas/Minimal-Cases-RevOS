
-- Remover TODAS as políticas existentes da tabela crm_usuarios
DROP POLICY IF EXISTS "authenticated_users_can_read_own_profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "authenticated_users_can_update_own_profile" ON public.crm_usuarios;
DROP POLICY IF EXISTS "super_admins_can_read_all" ON public.crm_usuarios;
DROP POLICY IF EXISTS "super_admins_can_manage_all" ON public.crm_usuarios;

-- Desabilitar RLS temporariamente para permitir acesso inicial
ALTER TABLE public.crm_usuarios DISABLE ROW LEVEL SECURITY;

-- Reabilitar RLS
ALTER TABLE public.crm_usuarios ENABLE ROW LEVEL SECURITY;

-- Criar política simples que permite que usuários autenticados vejam e editem apenas seu próprio perfil
CREATE POLICY "users_own_profile_access"
ON public.crm_usuarios
FOR ALL
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Criar política separada para permitir INSERT de novos perfis (necessário para criação automática)
CREATE POLICY "allow_profile_creation"
ON public.crm_usuarios
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());
