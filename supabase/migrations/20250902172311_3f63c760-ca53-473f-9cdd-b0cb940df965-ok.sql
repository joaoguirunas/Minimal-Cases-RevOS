-- MIGRAÇÃO FORÇADA: REMOÇÃO COMPLETA DAS POLÍTICAS RLS PROBLEMÁTICAS
-- Garantir que todas as políticas antigas sejam removidas

-- Primeiro, listar e dropar TODAS as políticas existentes na tabela crm_usuarios
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Buscar todas as políticas da tabela crm_usuarios
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'crm_usuarios'
    LOOP
        -- Dropar cada política encontrada
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            policy_record.policyname, 
            policy_record.schemaname, 
            policy_record.tablename);
        
        RAISE NOTICE 'Política removida: %', policy_record.policyname;
    END LOOP;
END
$$;

-- Agora criar APENAS as 4 políticas corretas, sem referências a auth.users
-- 1. SELECT: Usuário pode ver apenas seu próprio registro
CREATE POLICY "usuarios_select_own" ON crm_usuarios
FOR SELECT USING (
  auth_user_id = auth.uid() AND ativo = true
);

-- 2. UPDATE: Usuário pode atualizar apenas seu próprio registro  
CREATE POLICY "usuarios_update_own" ON crm_usuarios
FOR UPDATE USING (
  auth_user_id = auth.uid() AND ativo = true
);

-- 3. INSERT: Permitir criação de novos usuários autenticados
CREATE POLICY "usuarios_insert_authenticated" ON crm_usuarios
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth_user_id = auth.uid()
);

-- 4. DELETE: Apenas gestores e super admins do próprio tenant
CREATE POLICY "usuarios_delete_managers" ON crm_usuarios
FOR DELETE USING (
  -- Permitir que usuários deletem apenas no próprio tenant e sendo gestor/super_adm
  EXISTS (
    SELECT 1 FROM crm_usuarios u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.tenant_id = crm_usuarios.tenant_id 
    AND (u.gestor = true OR u.super_adm = true)
    AND u.ativo = true
  )
);

-- Verificar se RLS está habilitado
ALTER TABLE crm_usuarios ENABLE ROW LEVEL SECURITY;