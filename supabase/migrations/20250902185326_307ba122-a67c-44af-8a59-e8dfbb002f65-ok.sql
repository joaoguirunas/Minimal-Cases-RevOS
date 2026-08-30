-- Correção da recursão infinita nas políticas RLS da tabela crm_usuarios

-- 1. Remover todas as políticas problemáticas que causam recursão infinita
DROP POLICY IF EXISTS "User profile access" ON crm_usuarios;
DROP POLICY IF EXISTS "User profile updates" ON crm_usuarios; 
DROP POLICY IF EXISTS "User creation permissions" ON crm_usuarios;
DROP POLICY IF EXISTS "User deletion permissions" ON crm_usuarios;

-- 2. Remover as funções que causam recursão
DROP FUNCTION IF EXISTS is_user_super_admin(uuid);
DROP FUNCTION IF EXISTS is_user_manager_of_tenant(uuid, uuid);

-- 3. Garantir que apenas as políticas seguras existem
-- Verificar se a política segura de select existe
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
              (u2.tenant_id = crm_usuarios.tenant_id AND (u2.gestor = true OR u2.super_adm = true)) 
              OR u2.super_adm = true
            )
            AND u2.ativo = true
          )
        );
    END IF;
END $$;

-- 4. Política segura para insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_usuarios' 
        AND policyname = 'usuarios_insert_authenticated'
    ) THEN
        CREATE POLICY "usuarios_insert_authenticated" ON crm_usuarios
        FOR INSERT 
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM crm_usuarios u2 
            WHERE u2.auth_user_id = auth.uid() 
            AND (
              (u2.tenant_id = crm_usuarios.tenant_id AND (u2.gestor = true OR u2.super_adm = true)) 
              OR u2.super_adm = true
            )
            AND u2.ativo = true
          )
        );
    END IF;
END $$;

-- 5. Política segura para update
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_usuarios' 
        AND policyname = 'usuarios_update_own'
    ) THEN
        CREATE POLICY "usuarios_update_own" ON crm_usuarios
        FOR UPDATE 
        USING (
          auth_user_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM crm_usuarios u2 
            WHERE u2.auth_user_id = auth.uid() 
            AND (
              (u2.tenant_id = crm_usuarios.tenant_id AND (u2.gestor = true OR u2.super_adm = true)) 
              OR u2.super_adm = true
            )
            AND u2.ativo = true
          )
        );
    END IF;
END $$;

-- 6. Política segura para delete 
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_usuarios' 
        AND policyname = 'usuarios_delete_managers'
    ) THEN
        CREATE POLICY "usuarios_delete_managers" ON crm_usuarios
        FOR DELETE 
        USING (
          EXISTS (
            SELECT 1 FROM crm_usuarios u2 
            WHERE u2.auth_user_id = auth.uid() 
            AND (
              (u2.tenant_id = crm_usuarios.tenant_id AND (u2.gestor = true OR u2.super_adm = true)) 
              OR u2.super_adm = true
            )
            AND u2.ativo = true
          )
        );
    END IF;
END $$;