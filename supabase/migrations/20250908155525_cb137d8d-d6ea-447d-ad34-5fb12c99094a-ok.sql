-- Verificar e corrigir as políticas RLS
-- Primeiro, vamos verificar se temos dados e depois ajustar as políticas

-- Desabilitar RLS temporariamente para verificar dados
SET row_security = off;

-- Verificar se a agência existe (sem RLS)
DO $$
DECLARE
    agencia_count integer;
    usuario_count integer;
BEGIN
    SELECT COUNT(*) INTO agencia_count FROM crm_agencias WHERE id = '0369053d-8635-4103-9561-381f37801fb4';
    RAISE LOG 'Agencias encontradas: %', agencia_count;
    
    SELECT COUNT(*) INTO usuario_count FROM crm_usuarios;
    RAISE LOG 'Total de usuarios: %', usuario_count;
END $$;

-- Reabilitar RLS
SET row_security = on;

-- Remover política atual e criar uma nova mais permissiva
DROP POLICY IF EXISTS "Super admins can manage agencies" ON crm_agencias;

-- Nova política mais simples e clara
CREATE POLICY "Allow agency management" ON crm_agencias
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