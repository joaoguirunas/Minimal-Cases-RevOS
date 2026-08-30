-- Atualizar registros existentes que têm os 3 campos de score preenchidos
-- mas ainda não têm score_matrix_id vinculado
-- Isso vai disparar o trigger auto_link_score_matrix para cada registro

UPDATE public.clients_people
SET score_objective_id = score_objective_id
WHERE 
  score_objective_id IS NOT NULL 
  AND score_investment_id IS NOT NULL 
  AND score_framing_id IS NOT NULL
  AND score_matrix_id IS NULL;