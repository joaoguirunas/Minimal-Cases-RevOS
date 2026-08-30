-- Corrigir políticas RLS para crm_tenants
-- O linter mostra que há tabelas com RLS habilitado mas sem políticas

-- Verificar se crm_tenants existe e tem RLS habilitado
-- Criar políticas básicas para crm_tenants se necessário

-- 1. Política para SELECT em crm_tenants
CREATE POLICY "crm_tenants_select_policy" ON crm_tenants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE p.tenant_id = crm_tenants.id 
    OR p.is_super_adm = true
  )
);

-- 2. Política para INSERT em crm_tenants (apenas super admin)
CREATE POLICY "crm_tenants_insert_policy" ON crm_tenants
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE p.is_super_adm = true
  )
);

-- 3. Política para UPDATE em crm_tenants (apenas super admin)
CREATE POLICY "crm_tenants_update_policy" ON crm_tenants
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE p.is_super_adm = true
  )
);

-- 4. Política para DELETE em crm_tenants (apenas super admin)
CREATE POLICY "crm_tenants_delete_policy" ON crm_tenants
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.get_current_user_permissions() p 
    WHERE p.is_super_adm = true
  )
);

-- 5. Verificar e criar política INSERT para crm_usuarios se não existir
DO $$
BEGIN
  -- Política INSERT para crm_usuarios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'crm_usuarios' 
    AND policyname = 'crm_usuarios_insert_policy'
  ) THEN
    EXECUTE 'CREATE POLICY "crm_usuarios_insert_policy" ON crm_usuarios
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.get_current_user_permissions() p 
        WHERE (p.is_gestor = true OR p.is_super_adm = true) 
        AND p.is_ativo = true
      )
    )';
  END IF;
END
$$;