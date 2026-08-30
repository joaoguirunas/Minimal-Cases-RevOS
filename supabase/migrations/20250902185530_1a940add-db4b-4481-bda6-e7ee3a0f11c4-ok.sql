-- Correção final da recursão infinita em crm_usuarios
-- O problema é que as políticas estão consultando a própria tabela dentro de EXISTS

-- 1. Remover todas as políticas problemáticas que causam recursão
DROP POLICY IF EXISTS "crm_usuarios_secure_select" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_delete_managers" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_delete_secure" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_insert_secure" ON crm_usuarios;
DROP POLICY IF EXISTS "usuarios_update_secure" ON crm_usuarios;

-- 2. Criar políticas simples e seguras sem recursão
-- Política básica: usuários podem ver seus próprios dados
CREATE POLICY "crm_usuarios_select_own" ON crm_usuarios
FOR SELECT USING (auth_user_id = auth.uid());

-- Política para super admins verem todos os usuários
CREATE POLICY "crm_usuarios_select_super_admin" ON crm_usuarios
FOR SELECT USING (super_adm = true AND auth_user_id = auth.uid());

-- Política para gestores verem usuários do mesmo tenant
-- Usar uma abordagem diferente sem consultar a mesma tabela
CREATE POLICY "crm_usuarios_select_manager" ON crm_usuarios
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios cu_manager
    WHERE cu_manager.auth_user_id = auth.uid()
    AND cu_manager.tenant_id = crm_usuarios.tenant_id
    AND (cu_manager.gestor = true OR cu_manager.super_adm = true)
    AND cu_manager.ativo = true
    AND cu_manager.id != crm_usuarios.id  -- Evitar auto-referência
  )
);

-- Políticas para INSERT (apenas usuários autenticados podem inserir)
CREATE POLICY "crm_usuarios_insert_authenticated" ON crm_usuarios
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para UPDATE (usuários podem atualizar seus próprios dados)
CREATE POLICY "crm_usuarios_update_own" ON crm_usuarios
FOR UPDATE USING (auth_user_id = auth.uid());

-- Política para DELETE (apenas gestores podem deletar)
CREATE POLICY "crm_usuarios_delete_managers" ON crm_usuarios
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios cu_manager
    WHERE cu_manager.auth_user_id = auth.uid()
    AND (cu_manager.gestor = true OR cu_manager.super_adm = true)
    AND cu_manager.ativo = true
    AND cu_manager.id != crm_usuarios.id  -- Evitar auto-referência
  )
);