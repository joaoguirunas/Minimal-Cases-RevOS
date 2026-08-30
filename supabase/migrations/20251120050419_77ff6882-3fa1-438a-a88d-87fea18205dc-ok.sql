-- Etapa 1: Recriar tabela ai_agents_score_matrix
CREATE TABLE public.ai_agents_score_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  score_matrix_id uuid REFERENCES public.score_matrix(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(ai_agent_id, score_matrix_id)
);

-- Adicionar índices para performance
CREATE INDEX idx_ai_agents_score_matrix_agent_id ON public.ai_agents_score_matrix(ai_agent_id);
CREATE INDEX idx_ai_agents_score_matrix_score_id ON public.ai_agents_score_matrix(score_matrix_id);

-- Habilitar RLS
ALTER TABLE public.ai_agents_score_matrix ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "authenticated_read" ON public.ai_agents_score_matrix
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write" ON public.ai_agents_score_matrix
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Etapa 2: Migrar dados do array de volta para a tabela
INSERT INTO public.ai_agents_score_matrix (ai_agent_id, score_matrix_id, active)
SELECT 
  a.id as ai_agent_id,
  unnest(a.score_matrix_ids) as score_matrix_id,
  true as active
FROM public.ai_agents a
WHERE a.score_matrix_ids IS NOT NULL 
  AND array_length(a.score_matrix_ids, 1) > 0;

-- Etapa 3: Remover a coluna score_matrix_ids
ALTER TABLE public.ai_agents DROP COLUMN score_matrix_ids;