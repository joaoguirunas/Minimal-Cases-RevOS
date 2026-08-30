-- Correção definitiva das políticas RLS problemáticas na tabela crm_tenants
-- Remover todas as políticas antigas que fazem referência direta a auth.users

-- Remover políticas problemáticas da tabela crm_tenants
DROP POLICY IF EXISTS "Tenants can be selected by authenticated users" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants can be inserted by authenticated users" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants can be updated by authenticated users" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants can be deleted by authenticated users" ON crm_tenants;

-- Remover qualquer política ALL que possa estar conflitando
DROP POLICY IF EXISTS "crm_tenants_user_access" ON crm_tenants;

-- Garantir que RLS está habilitado
ALTER TABLE crm_tenants ENABLE ROW LEVEL SECURITY;

-- Verificar se as políticas corretas existem, se não, criar
DO $$
BEGIN
    -- Política para super admins verem todos os tenants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_tenants' 
        AND policyname = 'Super admins can view all tenants'
    ) THEN
        CREATE POLICY "Super admins can view all tenants" ON crm_tenants
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM crm_usuarios 
            WHERE crm_usuarios.auth_user_id = auth.uid() 
            AND crm_usuarios.super_adm = true 
            AND crm_usuarios.ativo = true
          )
        );
    END IF;

    -- Política para acesso seguro por tenant
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_tenants' 
        AND policyname = 'Tenant access with secure functions'
    ) THEN
        CREATE POLICY "Tenant access with secure functions" ON crm_tenants
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM crm_usuarios 
            WHERE crm_usuarios.auth_user_id = auth.uid() 
            AND crm_usuarios.tenant_id = crm_tenants.id 
            AND crm_usuarios.ativo = true
          )
        );
    END IF;

    -- Política para gestores manipularem tenants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_tenants' 
        AND policyname = 'Super admins can manage all tenants'
    ) THEN
        CREATE POLICY "Super admins can manage all tenants" ON crm_tenants
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM crm_usuarios 
            WHERE crm_usuarios.auth_user_id = auth.uid() 
            AND crm_usuarios.super_adm = true 
            AND crm_usuarios.ativo = true
          )
        );
    END IF;
END $$;

-- Verificar outras tabelas para políticas similares problemáticas
-- Limpar políticas problemáticas em outras tabelas críticas que possam estar afetando o dashboard

-- Verificar e limpar políticas problemáticas em crm_usuarios
DROP POLICY IF EXISTS "Users can view users from their tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can insert users in their tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can update users from their tenant" ON crm_usuarios;
DROP POLICY IF EXISTS "Users can delete users from their tenant" ON crm_usuarios;

-- Garantir políticas corretas em crm_usuarios existem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_usuarios' 
        AND policyname = 'crm_usuarios_secure_select'
    ) THEN
        CREATE POLICY "crm_usuarios_secure_select" ON crm_usuarios
        FOR SELECT USING (
          auth_user_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM crm_usuarios u2 
            WHERE u2.auth_user_id = auth.uid() 
            AND (
              (u2.tenant_id = crm_usuarios.tenant_id AND u2.gestor = true) 
              OR u2.super_adm = true
            )
            AND u2.ativo = true
          )
        );
    END IF;
END $$;