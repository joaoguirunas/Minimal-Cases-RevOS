-- Adicionar score_matrix_id aos followups de stages
ALTER TABLE public.leads_stages_followups 
ADD COLUMN score_matrix_id UUID NULL 
REFERENCES score_matrix(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX idx_followups_score ON leads_stages_followups(score_matrix_id);

-- Criar índice composto para queries de prioridade
CREATE INDEX idx_followups_stage_score ON leads_stages_followups(leads_stages_id, score_matrix_id);

-- Adicionar constraint para garantir ao menos um ID presente
ALTER TABLE leads_stages_followups 
ADD CONSTRAINT check_at_least_one_id 
CHECK (leads_stages_id IS NOT NULL OR score_matrix_id IS NOT NULL);

COMMENT ON COLUMN leads_stages_followups.score_matrix_id IS 'Score Matrix ID para followups específicos. NULL = aplica para todos os scores';
COMMENT ON CONSTRAINT check_at_least_one_id ON leads_stages_followups IS 'Garante que ao menos stage_id ou score_matrix_id esteja presente';