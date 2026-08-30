-- Criar tabela principal dos agentes IA
CREATE TABLE public.crm_agentes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  
  -- Dados atuais do agente (versão ativa)
  dados_entrada text,
  identidade text,
  regras_gerais text,
  prompt_base text,
  usa_etapas boolean NOT NULL DEFAULT false,
  
  -- Controle de versão
  versao_atual integer NOT NULL DEFAULT 1,
  
  -- Tenant isolation
  tenant_id uuid NOT NULL,
  
  -- Auditoria
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_agentes_ia ENABLE ROW LEVEL SECURITY;

-- Policy para agentes IA
CREATE POLICY "Users can manage agents from their tenant" ON public.crm_agentes_ia
  FOR ALL USING (user_has_tenant_access(tenant_id))
  WITH CHECK (user_has_tenant_access(tenant_id));

-- Criar tabela de histórico/versionamento
CREATE TABLE public.crm_agentes_ia_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_ia_id uuid NOT NULL REFERENCES crm_agentes_ia(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  
  -- Snapshot completo da versão
  dados_entrada text,
  identidade text,
  regras_gerais text,
  prompt_base text,
  usa_etapas boolean NOT NULL DEFAULT false,
  
  -- Metadados da versão
  changelog text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(agente_ia_id, versao)
);

-- Habilitar RLS
ALTER TABLE public.crm_agentes_ia_historico ENABLE ROW LEVEL SECURITY;

-- Policy para histórico
CREATE POLICY "Users can view agent history from their tenant" ON public.crm_agentes_ia_historico
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_agentes_ia 
      WHERE id = agente_ia_id 
      AND user_has_tenant_access(tenant_id)
    )
  );

-- Criar tabela de etapas
CREATE TABLE public.crm_agentes_ia_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_ia_id uuid NOT NULL REFERENCES crm_agentes_ia(id) ON DELETE CASCADE,
  nome_etapa text NOT NULL,
  prompt_etapa text NOT NULL,
  ordem integer NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(agente_ia_id, ordem)
);

-- Habilitar RLS
ALTER TABLE public.crm_agentes_ia_etapas ENABLE ROW LEVEL SECURITY;

-- Policy para etapas
CREATE POLICY "Users can manage etapas from their tenant agents" ON public.crm_agentes_ia_etapas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_agentes_ia 
      WHERE id = agente_ia_id 
      AND user_has_tenant_access(tenant_id)
    )
  );

-- Criar tabela de histórico das etapas
CREATE TABLE public.crm_agentes_ia_etapas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_ia_id uuid NOT NULL REFERENCES crm_agentes_ia(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  nome_etapa text NOT NULL,
  prompt_etapa text NOT NULL,
  ordem integer NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  FOREIGN KEY (agente_ia_id, versao) REFERENCES crm_agentes_ia_historico(agente_ia_id, versao)
);

-- Habilitar RLS
ALTER TABLE public.crm_agentes_ia_etapas_historico ENABLE ROW LEVEL SECURITY;

-- Policy para histórico de etapas
CREATE POLICY "Users can view etapas history from their tenant" ON public.crm_agentes_ia_etapas_historico
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crm_agentes_ia 
      WHERE id = agente_ia_id 
      AND user_has_tenant_access(tenant_id)
    )
  );

-- Função para criar backup automático
CREATE OR REPLACE FUNCTION public.criar_backup_agente(agente_id uuid, changelog_text text DEFAULT NULL)
RETURNS void AS $$
DECLARE
  nova_versao integer;
BEGIN
  -- Obter próxima versão
  SELECT COALESCE(MAX(versao), 0) + 1 INTO nova_versao
  FROM crm_agentes_ia_historico 
  WHERE agente_ia_id = agente_id;
  
  -- Backup do agente
  INSERT INTO crm_agentes_ia_historico (
    agente_ia_id, versao, dados_entrada, identidade, regras_gerais, 
    prompt_base, usa_etapas, changelog, created_by
  )
  SELECT 
    id, nova_versao, dados_entrada, identidade, regras_gerais,
    prompt_base, usa_etapas, changelog_text, updated_by
  FROM crm_agentes_ia 
  WHERE id = agente_id;
  
  -- Backup das etapas
  INSERT INTO crm_agentes_ia_etapas_historico (
    agente_ia_id, versao, nome_etapa, prompt_etapa, ordem, ativa
  )
  SELECT 
    agente_ia_id, nova_versao, nome_etapa, prompt_etapa, ordem, ativa
  FROM crm_agentes_ia_etapas 
  WHERE agente_ia_id = agente_id;
  
  -- Atualizar versão atual
  UPDATE crm_agentes_ia 
  SET versao_atual = nova_versao, updated_at = now()
  WHERE id = agente_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agentes_ia_updated_at
  BEFORE UPDATE ON crm_agentes_ia
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER update_agentes_ia_etapas_updated_at
  BEFORE UPDATE ON crm_agentes_ia_etapas
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Índices para performance
CREATE INDEX idx_agentes_ia_tenant_id ON crm_agentes_ia(tenant_id);
CREATE INDEX idx_agentes_ia_historico_agente_id ON crm_agentes_ia_historico(agente_ia_id);
CREATE INDEX idx_agentes_ia_etapas_agente_id ON crm_agentes_ia_etapas(agente_ia_id);
CREATE INDEX idx_agentes_ia_etapas_historico_agente_versao ON crm_agentes_ia_etapas_historico(agente_ia_id, versao);