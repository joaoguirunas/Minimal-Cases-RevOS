-- Remover políticas RLS conflitantes que causam erro "permission denied for table users"

-- Remover políticas antigas que fazem referência direta à tabela auth.users
DROP POLICY IF EXISTS "Tenants can be created by super admins only" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants can be deleted by super admins only" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants can be updated by managers or super admins" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants can be viewed by their users or super admins" ON crm_tenants;

-- Remover políticas duplicadas que fazem referência direta à crm_usuarios
DROP POLICY IF EXISTS "Tenants delete secure" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants insert secure" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants select secure" ON crm_tenants;
DROP POLICY IF EXISTS "Tenants update secure" ON crm_tenants;

-- Manter apenas as políticas corretas que usam get_current_user_permissions()
-- (crm_tenants_select_policy, crm_tenants_insert_policy, crm_tenants_update_policy, crm_tenants_delete_policy)
-- Estas já foram criadas na migração anterior