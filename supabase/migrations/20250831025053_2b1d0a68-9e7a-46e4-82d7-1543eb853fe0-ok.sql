-- Habilitar extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Criar tabela para conexões LLM
CREATE TABLE crm_llm_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  api_key text NOT NULL, -- Criptografado
  model_default text NOT NULL,
  temperature numeric DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens integer DEFAULT NULL,
  ativo boolean NOT NULL DEFAULT true,
  
  -- Configurações avançadas por provider
  config_adicional jsonb DEFAULT '{}',
  
  -- Status da conexão
  status_conexao text DEFAULT 'não_testado' CHECK (status_conexao IN ('ativo', 'erro', 'não_testado')),
  ultimo_teste timestamp with time zone,
  mensagem_erro text,
  
  -- Tenant isolation
  tenant_id uuid NOT NULL REFERENCES crm_tenants(id),
  
  -- Auditoria
  created_by uuid REFERENCES crm_usuarios(id),
  updated_by uuid REFERENCES crm_usuarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Um provider por tenant
  UNIQUE(tenant_id, provider)
);

-- Criar tabela para logs de uso LLM
CREATE TABLE crm_llm_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES crm_llm_connections(id),
  provider text NOT NULL,
  model text NOT NULL,
  tokens_input integer,
  tokens_output integer,
  tokens_total integer GENERATED ALWAYS AS (COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)) STORED,
  custo_estimado numeric,
  funcionalidade text NOT NULL, -- De onde veio a chamada (agentes_ia, disc_analysis, etc)
  prompt_preview text, -- Primeiros 100 chars do prompt para identificação
  tempo_resposta integer, -- em ms
  sucesso boolean NOT NULL,
  erro text,
  
  -- Tenant isolation
  tenant_id uuid NOT NULL REFERENCES crm_tenants(id),
  
  -- Auditoria
  usuario_id uuid REFERENCES crm_usuarios(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_llm_connections_tenant ON crm_llm_connections(tenant_id);
CREATE INDEX idx_llm_connections_provider ON crm_llm_connections(provider);
CREATE INDEX idx_llm_usage_tenant ON crm_llm_usage_logs(tenant_id);
CREATE INDEX idx_llm_usage_provider ON crm_llm_usage_logs(provider);
CREATE INDEX idx_llm_usage_created_at ON crm_llm_usage_logs(created_at);
CREATE INDEX idx_llm_usage_funcionalidade ON crm_llm_usage_logs(funcionalidade);

-- RLS Policies para conexões LLM
ALTER TABLE crm_llm_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only managers can manage llm connections" ON crm_llm_connections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND tenant_id = crm_llm_connections.tenant_id
      AND (gestor = true OR super_adm = true)
    ) OR 
    EXISTS (
      SELECT 1 FROM crm_usuarios 
      WHERE auth_user_id = auth.uid() 
      AND super_adm = true
    )
  );

-- RLS Policies para logs de uso
ALTER TABLE crm_llm_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view usage logs from their tenant" ON crm_llm_usage_logs
  FOR SELECT USING (user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert usage logs in their tenant" ON crm_llm_usage_logs
  FOR INSERT WITH CHECK (user_has_tenant_access(tenant_id));

-- Funções para criptografia de API keys
CREATE OR REPLACE FUNCTION encrypt_api_key(key_value text, secret_key text)
RETURNS text AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(key_value, secret_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key text, secret_key text)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), secret_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_llm_connections_updated_at
  BEFORE UPDATE ON crm_llm_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();