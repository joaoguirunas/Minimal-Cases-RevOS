-- Políticas RLS para a tabela settings_users

-- Permitir que usuários autenticados possam inserir seu próprio registro
CREATE POLICY "Users can insert their own profile"
ON public.settings_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

-- Permitir que usuários autenticados possam ler todos os perfis
CREATE POLICY "Users can view all profiles"
ON public.settings_users
FOR SELECT
TO authenticated
USING (true);

-- Permitir que usuários possam atualizar seu próprio perfil
CREATE POLICY "Users can update their own profile"
ON public.settings_users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Permitir que super admins possam fazer qualquer operação
CREATE POLICY "Super admins have full access"
ON public.settings_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.settings_users
    WHERE auth_user_id = auth.uid()
    AND super_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.settings_users
    WHERE auth_user_id = auth.uid()
    AND super_admin = true
  )
);