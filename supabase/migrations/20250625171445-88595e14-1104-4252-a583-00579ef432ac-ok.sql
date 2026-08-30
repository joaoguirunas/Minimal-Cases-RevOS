
-- 1. Atualizar tabela crm_usuarios_globais para incluir campo admin
ALTER TABLE crm_usuarios_globais 
ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT false;

-- 2. Atualizar tabela crm_usuarios para incluir os novos campos necessários
ALTER TABLE crm_usuarios 
ADD COLUMN IF NOT EXISTS usuario_global_id UUID REFERENCES crm_usuarios_globais(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 3. Criar índice único para evitar duplicidade de vínculo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_tenant 
ON crm_usuarios (usuario_global_id, tenant_id) 
WHERE deleted_at IS NULL;

-- 4. Criar tabela para controle de sessão ativa (opcional - pode ser feito em memória também)
CREATE TABLE IF NOT EXISTS crm_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_global_id UUID REFERENCES crm_usuarios_globais(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES crm_tenants(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days')
);

-- 5. Criar tabela de convites (estrutura base para futuro)
CREATE TABLE IF NOT EXISTS crm_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tenant_id UUID REFERENCES crm_tenants(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'user',
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, accepted, expired, cancelled
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  invited_by_id UUID REFERENCES crm_usuarios_globais(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- 6. Adicionar trigger para updated_at na tabela de sessões
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_user_sessions
  BEFORE UPDATE ON crm_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- 7. Garantir que todas as tabelas de negócio tenham tenant_id obrigatório
-- (As tabelas já têm tenant_id, então vamos apenas garantir que não sejam nullable onde necessário)
ALTER TABLE crm_leads ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_pessoas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_empresas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_pipelines ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_stages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE crm_campos_personalizados ALTER COLUMN tenant_id SET NOT NULL;
