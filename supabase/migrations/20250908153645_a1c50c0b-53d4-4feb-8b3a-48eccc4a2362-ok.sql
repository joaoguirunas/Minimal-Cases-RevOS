-- Remover políticas existentes problemáticas
DROP POLICY IF EXISTS "Super admins can manage agencies" ON public.crm_agencias;
DROP POLICY IF EXISTS "Super admins can manage agency tenant relations" ON public.crm_agencia_tenants;

-- Criar função de segurança para verificar se o usuário é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se é um dos emails específicos ou se é super_adm na tabela de usuários
  RETURN (
    auth.jwt() ->> 'email' IN ('rafaela@iatize.com', 'joao@iatize.com')
    OR EXISTS (
      SELECT 1 FROM public.crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true 
      AND ativo = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Políticas RLS para crm_agencias usando a função
CREATE POLICY "Super admins can manage agencies" 
ON public.crm_agencias 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Políticas RLS para crm_agencia_tenants usando a função
CREATE POLICY "Super admins can manage agency tenant relations" 
ON public.crm_agencia_tenants 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());