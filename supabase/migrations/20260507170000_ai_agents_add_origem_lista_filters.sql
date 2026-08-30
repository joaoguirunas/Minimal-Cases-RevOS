-- 20260507170000_ai_agents_add_origem_lista_filters.sql
-- Brief: Adiciona filtro por origem_lista nos agentes IA

BEGIN;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS origem_lista_filters text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS ai_agents_origem_lista_gin
  ON public.ai_agents USING GIN (origem_lista_filters);

COMMENT ON COLUMN public.ai_agents.origem_lista_filters IS
  'Se não vazio, agente só dispara para leads cuja origem_lista esteja neste array. Vazio = sem filtro (todos).';

COMMIT;
