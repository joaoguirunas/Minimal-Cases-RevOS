
-- Criar tabela para follow-ups das etapas
CREATE TABLE public.crm_stage_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  dias INTEGER NOT NULL DEFAULT 0,
  horas INTEGER NOT NULL DEFAULT 0,
  mensagem TEXT,
  tipo TEXT NOT NULL DEFAULT 'texto',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assunto TEXT,
  arquivo_audio TEXT
);

-- Índices para otimização de consultas
CREATE INDEX idx_crm_stage_followups_tenant_id ON public.crm_stage_followups(tenant_id);
CREATE INDEX idx_crm_stage_followups_stage_id ON public.crm_stage_followups(stage_id);

-- Trigger para atualização automática do updated_at
CREATE TRIGGER trigger_crm_stage_followups_updated_at
  BEFORE UPDATE ON public.crm_stage_followups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS (Row Level Security) para isolamento por tenant
ALTER TABLE public.crm_stage_followups ENABLE ROW LEVEL SECURITY;

-- Política RLS para crm_stage_followups
CREATE POLICY "crm_stage_followups_tenant_isolation" ON public.crm_stage_followups
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
