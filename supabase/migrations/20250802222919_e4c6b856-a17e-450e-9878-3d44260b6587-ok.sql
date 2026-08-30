-- Política para permitir super admins deletarem outros usuários globais
CREATE POLICY "Super admins can delete global users" 
ON public.crm_usuarios 
FOR DELETE 
USING (
  -- Verificar se o usuário atual é super admin
  EXISTS (
    SELECT 1 FROM public.crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  )
  -- E garantir que não está tentando deletar a si mesmo
  AND auth_user_id != auth.uid()
  -- E que o usuário a ser deletado é um usuário global (super admin)
  AND super_adm = true
);

-- Política mais flexível para SELECT permitindo super admins verem todos os usuários globais
DROP POLICY IF EXISTS "users_can_read_own_profile" ON public.crm_usuarios;
CREATE POLICY "Global users can read profiles" 
ON public.crm_usuarios 
FOR SELECT 
USING (
  -- Usuários podem ver seu próprio perfil
  auth_user_id = auth.uid()
  OR 
  -- Super admins podem ver todos os usuários globais
  (
    EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true 
      AND ativo = true
    ) 
    AND super_adm = true
  )
);

-- Política para UPDATE mais específica para super admins
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.crm_usuarios;
CREATE POLICY "Global users can update profiles" 
ON public.crm_usuarios 
FOR UPDATE 
USING (
  -- Usuários podem atualizar seu próprio perfil
  auth_user_id = auth.uid()
  OR 
  -- Super admins podem atualizar outros usuários globais (mas não desativar a si mesmos)
  (
    EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true 
      AND ativo = true
    ) 
    AND super_adm = true
    AND (auth_user_id != auth.uid() OR NEW.ativo = true)
  )
)
WITH CHECK (
  -- Usuários podem atualizar seu próprio perfil
  auth_user_id = auth.uid()
  OR 
  -- Super admins podem atualizar outros usuários globais
  (
    EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true 
      AND ativo = true
    ) 
    AND super_adm = true
    AND (auth_user_id != auth.uid() OR NEW.ativo = true)
  )
);