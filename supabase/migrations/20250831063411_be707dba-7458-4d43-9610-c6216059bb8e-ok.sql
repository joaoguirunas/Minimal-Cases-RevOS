-- Adicionar colunas pipeline_id, stage_id e controle à tabela crm_agentes_ia_etapas
ALTER TABLE public.crm_agentes_ia_etapas 
ADD COLUMN pipeline_id uuid,
ADD COLUMN stage_id uuid,
ADD COLUMN controle text;

-- Adicionar índices para performance
CREATE INDEX idx_crm_agentes_ia_etapas_pipeline_id ON public.crm_agentes_ia_etapas(pipeline_id);
CREATE INDEX idx_crm_agentes_ia_etapas_stage_id ON public.crm_agentes_ia_etapas(stage_id);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.crm_agentes_ia_etapas.pipeline_id IS 'ID do pipeline associado à etapa do agente';
COMMENT ON COLUMN public.crm_agentes_ia_etapas.stage_id IS 'ID da etapa do pipeline associada à etapa do agente';
COMMENT ON COLUMN public.crm_agentes_ia_etapas.controle IS 'Campo de controle para a etapa do agente';