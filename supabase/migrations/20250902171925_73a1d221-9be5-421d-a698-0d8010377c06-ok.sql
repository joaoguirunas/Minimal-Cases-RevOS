-- LIMPEZA COMPLETA DAS POLÍTICAS RLS DO crm_usuarios
-- Remover TODAS as políticas existentes para eliminar conflitos

-- Dropar todas as políticas problemáticas
DROP POLICY IF EXISTS "crm_usuarios_ultra_simple_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_ultra_simple_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_ultra_simple_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_ultra_simple_delete" ON crm_usuarios;

DROP POLICY IF EXISTS "crm_usuarios_simple_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_simple_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_simple_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_simple_delete" ON crm_usuarios;

DROP POLICY IF EXISTS "crm_usuarios_own_record_select" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_own_record_update" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_authenticated_insert" ON crm_usuarios;
DROP POLICY IF EXISTS "crm_usuarios_authenticated_delete" ON crm_usuarios;

-- Criar políticas finais limpas e simples
-- 1. SELECT: Usuário pode ver apenas seu próprio registro
CREATE POLICY "usuarios_select_own" ON crm_usuarios
FOR SELECT USING (
  auth_user_id = auth.uid()
);

-- 2. UPDATE: Usuário pode atualizar apenas seu próprio registro  
CREATE POLICY "usuarios_update_own" ON crm_usuarios
FOR UPDATE USING (
  auth_user_id = auth.uid()
);

-- 3. INSERT: Permitir criação de novos usuários autenticados
CREATE POLICY "usuarios_insert_authenticated" ON crm_usuarios
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth_user_id = auth.uid()
);

-- 4. DELETE: Apenas super admins específicos (sem subquery em auth.users)
CREATE POLICY "usuarios_delete_admins" ON crm_usuarios
FOR DELETE USING (
  auth.uid() IN (
    '77234261-18b8-497b-adee-172124ebc4f9'::uuid, -- rafaela@iatize.com
    'ab8cff3a-9b45-4c3d-8f2e-1234567890ab'::uuid  -- joao@iatize.com (se necessário)
  )
);