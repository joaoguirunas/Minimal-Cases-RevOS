-- Adicionar colunas de score à tabela clients_people
ALTER TABLE public.clients_people
ADD COLUMN score_framing_id UUID REFERENCES public.score_framings(id) ON DELETE SET NULL,
ADD COLUMN score_income_id UUID REFERENCES public.score_incomes(id) ON DELETE SET NULL,
ADD COLUMN score_objective_id UUID REFERENCES public.score_objectives(id) ON DELETE SET NULL;

-- Criar índices para melhorar performance nas queries
CREATE INDEX idx_clients_people_score_framing ON public.clients_people(score_framing_id);
CREATE INDEX idx_clients_people_score_income ON public.clients_people(score_income_id);
CREATE INDEX idx_clients_people_score_objective ON public.clients_people(score_objective_id);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.clients_people.score_framing_id IS 'Referência ao enquadramento (framing) do score da pessoa';
COMMENT ON COLUMN public.clients_people.score_income_id IS 'Referência à renda (income) do score da pessoa';
COMMENT ON COLUMN public.clients_people.score_objective_id IS 'Referência ao objetivo (objective) do score da pessoa';