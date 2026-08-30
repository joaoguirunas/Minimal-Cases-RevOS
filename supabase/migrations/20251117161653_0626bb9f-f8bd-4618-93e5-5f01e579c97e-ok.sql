-- Passo 1: Remover políticas problemáticas em settings_users
DROP POLICY IF EXISTS "Super admins have full access" ON public.settings_users;
DROP POLICY IF EXISTS "Admins can create users" ON public.settings_users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.settings_users;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.settings_users;
DROP POLICY IF EXISTS "authenticated_read" ON public.settings_users;

-- Passo 2: Criar políticas seguras usando has_role
CREATE POLICY "users_select_policy" ON public.settings_users
FOR SELECT TO authenticated
USING (
  auth.uid() = auth_user_id 
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "users_insert_policy" ON public.settings_users
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = auth_user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "users_update_policy" ON public.settings_users
FOR UPDATE TO authenticated
USING (
  auth.uid() = auth_user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  auth.uid() = auth_user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "users_delete_policy" ON public.settings_users
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Passo 3: Backfill user_roles - Admin (super_admin = true)
INSERT INTO public.user_roles (user_id, role)
SELECT auth_user_id, 'admin'::app_role
FROM public.settings_users
WHERE super_admin = true AND active = true AND auth_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Passo 4: Backfill user_roles - Manager (user_type = 'gestor')
INSERT INTO public.user_roles (user_id, role)
SELECT auth_user_id, 'manager'::app_role
FROM public.settings_users
WHERE user_type = 'gestor' AND active = true AND auth_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;