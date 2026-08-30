-- Verificar se os dados estão sendo inseridos mas não visíveis devido a RLS
SET row_security = off;
SELECT * FROM crm_agencia_tenants ORDER BY created_at DESC LIMIT 10;
SET row_security = on;

-- Corrigir as políticas RLS para as tabelas de relacionamento
DROP POLICY IF EXISTS "Super admins can manage agency tenant relations" ON crm_agencia_tenants;
DROP POLICY IF EXISTS "Super admins can manage agency user relations" ON crm_agencia_usuarios;

-- Nova política para crm_agencia_tenants
CREATE POLICY "Allow agency tenant management" ON crm_agencia_tenants
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND u.ativo = true
            AND (u.super_adm = true OR u.gestor = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND u.ativo = true
            AND (u.super_adm = true OR u.gestor = true)
        )
    );

-- Nova política para crm_agencia_usuarios
CREATE POLICY "Allow agency user management" ON crm_agencia_usuarios
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND u.ativo = true
            AND (u.super_adm = true OR u.gestor = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM crm_usuarios u
            WHERE u.auth_user_id = auth.uid()
            AND u.ativo = true
            AND (u.super_adm = true OR u.gestor = true)
        )
    );