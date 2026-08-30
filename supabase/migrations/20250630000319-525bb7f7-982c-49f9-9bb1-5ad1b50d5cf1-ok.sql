
-- Criar tabela de tipos de time
CREATE TYPE public.tipo_time AS ENUM ('suporte', 'vendas');

-- Criar tabela de times de atendimento
CREATE TABLE public.crm_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  prioridade INTEGER NOT NULL DEFAULT 1,
  tipo tipo_time NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de relacionamento entre usuários e times
CREATE TABLE public.crm_usuario_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  time_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, time_id)
);

-- Atualizar enum tipo_usuario para incluir gestor e atendimento
ALTER TYPE public.tipo_usuario ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE public.tipo_usuario ADD VALUE IF NOT EXISTS 'atendimento';

-- Adicionar trigger para updated_at na tabela de times
CREATE TRIGGER trigger_crm_times_updated_at
  BEFORE UPDATE ON public.crm_times
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

-- Adicionar índices para performance
CREATE INDEX idx_crm_times_tenant_id ON public.crm_times(tenant_id);
CREATE INDEX idx_crm_times_tipo ON public.crm_times(tipo);
CREATE INDEX idx_crm_usuario_times_usuario_id ON public.crm_usuario_times(usuario_id);
CREATE INDEX idx_crm_usuario_times_time_id ON public.crm_usuario_times(time_id);
CREATE INDEX idx_crm_usuario_times_tenant_id ON public.crm_usuario_times(tenant_id);

-- Atualizar tabela crm_leads para incluir responsavel como referência a usuário
ALTER TABLE public.crm_leads 
ALTER COLUMN responsavel TYPE UUID USING responsavel::UUID;

-- Adicionar comentários para documentação
COMMENT ON TABLE public.crm_times IS 'Times de atendimento (suporte, vendas, etc)';
COMMENT ON TABLE public.crm_usuario_times IS 'Relacionamento entre usuários e times de atendimento';
COMMENT ON COLUMN public.crm_times.prioridade IS 'Prioridade do time (1 = maior prioridade)';
COMMENT ON COLUMN public.crm_leads.responsavel IS 'ID do usuário responsável pelo negócio';
