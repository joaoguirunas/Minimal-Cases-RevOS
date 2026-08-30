-- Limpeza final das políticas RLS duplicadas
-- Remover todas as políticas antigas que fazem referência a auth.users

-- Remover políticas antigas da tabela crm_pessoa_empresas
DROP POLICY IF EXISTS "Users can delete pessoa_empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can insert pessoa_empresas in their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can update pessoa_empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can view pessoa_empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can delete pessoa-empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can insert pessoa-empresas in their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can update pessoa-empresas from their tenant" ON crm_pessoa_empresas;
DROP POLICY IF EXISTS "Users can view pessoa-empresas from their tenant" ON crm_pessoa_empresas;

-- Verificar e remover qualquer política ALL que possa estar conflitando
DROP POLICY IF EXISTS "crm_pessoa_empresas_user_access" ON crm_pessoa_empresas;

-- Garantir que RLS está habilitado
ALTER TABLE crm_pessoa_empresas ENABLE ROW LEVEL SECURITY;

-- Verificar se as políticas corretas existem, se não, criar
DO $$
BEGIN
    -- Política SELECT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_pessoa_empresas' 
        AND policyname = 'crm_pessoa_empresas_select_policy'
    ) THEN
        CREATE POLICY "crm_pessoa_empresas_select_policy" ON crm_pessoa_empresas
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM crm_usuarios 
            WHERE crm_usuarios.auth_user_id = auth.uid() 
            AND (
              crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
              OR crm_usuarios.super_adm = true
            )
            AND crm_usuarios.ativo = true
          )
        );
    END IF;

    -- Política INSERT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_pessoa_empresas' 
        AND policyname = 'crm_pessoa_empresas_insert_policy'
    ) THEN
        CREATE POLICY "crm_pessoa_empresas_insert_policy" ON crm_pessoa_empresas
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM crm_usuarios 
            WHERE crm_usuarios.auth_user_id = auth.uid() 
            AND (
              crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
              OR crm_usuarios.super_adm = true
            )
            AND crm_usuarios.ativo = true
          )
        );
    END IF;

    -- Política UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_pessoa_empresas' 
        AND policyname = 'crm_pessoa_empresas_update_policy'
    ) THEN
        CREATE POLICY "crm_pessoa_empresas_update_policy" ON crm_pessoa_empresas
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM crm_usuarios 
            WHERE crm_usuarios.auth_user_id = auth.uid() 
            AND (
              crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
              OR crm_usuarios.super_adm = true
            )
            AND crm_usuarios.ativo = true
          )
        );
    END IF;

    -- Política DELETE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'crm_pessoa_empresas' 
        AND policyname = 'crm_pessoa_empresas_delete_policy'
    ) THEN
        CREATE POLICY "crm_pessoa_empresas_delete_policy" ON crm_pessoa_empresas
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM crm_usuarios 
            WHERE crm_usuarios.auth_user_id = auth.uid() 
            AND (
              crm_usuarios.tenant_id = crm_pessoa_empresas.tenant_id 
              OR crm_usuarios.super_adm = true
            )
            AND crm_usuarios.ativo = true
            AND (crm_usuarios.gestor = true OR crm_usuarios.super_adm = true)
          )
        );
    END IF;
END $$;