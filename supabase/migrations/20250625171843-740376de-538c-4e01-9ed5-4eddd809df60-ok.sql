
-- 1. Primeiro, migrar dados dos usuários globais para crm_usuarios (se houver)
INSERT INTO crm_usuarios (
  nome, 
  email, 
  senha, 
  tipo_usuario, 
  ativo, 
  super_adm,
  tenant_id,
  created_at,
  updated_at
)
SELECT 
  nome,
  email,
  senha,
  CASE WHEN admin = true THEN 'admin_global'::tipo_usuario ELSE 'usuario_cliente'::tipo_usuario END,
  ativo,
  admin,
  NULL, -- usuários globais não têm tenant específico
  created_at,
  updated_at
FROM crm_usuarios_globais
WHERE email NOT IN (SELECT email FROM crm_usuarios);

-- 2. Adicionar colunas necessárias à tabela crm_usuarios para unificação
ALTER TABLE crm_usuarios 
ADD COLUMN IF NOT EXISTS admin_global BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 3. Atualizar usuários existentes para refletir se são admins globais
UPDATE crm_usuarios 
SET admin_global = true, tipo_usuario = 'admin_global'
WHERE super_adm = true OR tipo_usuario = 'admin_global';

-- 4. Remover constraint que impede admin_global na tabela usuarios
ALTER TABLE crm_usuarios DROP CONSTRAINT IF EXISTS check_no_global_users;

-- 5. Criar índice único para email (já que não teremos mais duplicação)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_unique 
ON crm_usuarios (email) 
WHERE deleted_at IS NULL;

-- 6. Inserir usuário administrador do sistema
INSERT INTO crm_usuarios (
  nome,
  email,
  senha,
  tipo_usuario,
  ativo,
  super_adm,
  admin_global,
  tenant_id
) VALUES (
  'João Silva',
  'joao@iatize.com',
  'shoyo2010',
  'admin_global',
  true,
  true,
  true,
  NULL
) ON CONFLICT (email) DO UPDATE SET
  senha = EXCLUDED.senha,
  admin_global = true,
  super_adm = true,
  tipo_usuario = 'admin_global';

-- 7. Remover tabelas que não serão mais necessárias
DROP TABLE IF EXISTS crm_user_sessions;
DROP TABLE IF EXISTS crm_invitations;
DROP TABLE IF EXISTS crm_usuarios_globais CASCADE;

-- 8. Atualizar constraint para permitir tenant_id nulo para admins globais
ALTER TABLE crm_usuarios 
ALTER COLUMN tenant_id DROP NOT NULL;

-- 9. Adicionar constraint para garantir que apenas admins globais podem ter tenant_id nulo
ALTER TABLE crm_usuarios 
ADD CONSTRAINT check_tenant_id_for_non_global 
CHECK (
  (admin_global = true AND tenant_id IS NULL) OR 
  (admin_global = false AND tenant_id IS NOT NULL)
);
