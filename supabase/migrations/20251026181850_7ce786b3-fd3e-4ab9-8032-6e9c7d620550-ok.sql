-- Adicionar stage_id na tabela ai_agents
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_stage_id ON public.ai_agents(stage_id);

-- Comentário explicativo
COMMENT ON COLUMN public.ai_agents.stage_id IS 'Etapa do pipeline à qual este agente está associado (1 agente = 1 etapa)';