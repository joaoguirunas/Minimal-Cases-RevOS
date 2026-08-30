-- Correção completa da recursão infinita - removendo todas as dependências primeiro

-- 1. Remover TODAS as políticas que dependem das funções problemáticas em crm_tenants
DROP POLICY IF EXISTS "Tenant access with secure functions" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins create tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Tenant update permissions" ON crm_tenants;
DROP POLICY IF EXISTS "Only super admins delete tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can view all tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can insert tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can update all tenants" ON crm_tenants;
DROP POLICY IF EXISTS "Super admins can delete tenants" ON crm_tenants;

-- 2. Remover políticas problemáticas em crm_usuarios
DROP POLICY IF EXISTS "User profile access" ON crm_usuarios;
DROP POLICY IF EXISTS "User profile updates" ON crm_usuarios; 
DROP POLICY IF EXISTS "User creation permissions" ON crm_usuarios;
DROP POLICY IF EXISTS "User deletion permissions" ON crm_usuarios;

-- 3. Agora remover as funções problemáticas
DROP FUNCTION IF EXISTS is_user_super_admin(uuid);
DROP FUNCTION IF EXISTS is_user_manager_of_tenant(uuid, uuid);

-- 4. Recriar políticas seguras para crm_tenants (sem recursão)
CREATE POLICY "Tenants select secure" ON crm_tenants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND (
      crm_usuarios.tenant_id = crm_tenants.id 
      OR crm_usuarios.super_adm = true
    )
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Tenants insert secure" ON crm_tenants
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Tenants update secure" ON crm_tenants
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);

CREATE POLICY "Tenants delete secure" ON crm_tenants
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios 
    WHERE crm_usuarios.auth_user_id = auth.uid() 
    AND crm_usuarios.super_adm = true
    AND crm_usuarios.ativo = true
  )
);

-- 5. Garantir políticas seguras para crm_usuarios (sem recursão)
DO $$
BEGIN
    -- Remover política antiga se existe
    DROP POLICY IF EXISTS "crm_usuarios_secure_select" ON crm_usuarios;
    
    -- Criar política segura
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
END $$;

-- 6. Políticas para outras operações em crm_usuarios
CREATE POLICY "usuarios_insert_secure" ON crm_usuarios
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_usuarios u2 
    WHERE u2.auth_user_id = auth.uid() 
    AND (u2.gestor = true OR u2.super_adm = true)
    AND u2.ativo = true
  )
);

CREATE POLICY "usuarios_update_secure" ON crm_usuarios
FOR UPDATE 
USING (
  auth_user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM crm_usuarios u2 
    WHERE u2.auth_user_id = auth.uid() 
    AND (u2.gestor = true OR u2.super_adm = true)
    AND u2.ativo = true
  )
);

CREATE POLICY "usuarios_delete_secure" ON crm_usuarios
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM crm_usuarios u2 
    WHERE u2.auth_user_id = auth.uid() 
    AND (u2.gestor = true OR u2.super_adm = true)
    AND u2.ativo = true
  )
);