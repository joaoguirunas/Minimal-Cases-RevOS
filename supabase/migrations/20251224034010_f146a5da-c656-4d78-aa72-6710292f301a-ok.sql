-- Função para buscar a matriz de score correspondente
CREATE OR REPLACE FUNCTION public.find_score_matrix(
  p_objective_id uuid,
  p_investment_id uuid,
  p_framing_id uuid
)
RETURNS TABLE(matrix_id uuid, matrix_score integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    sm.score_number
  FROM public.score_matrix sm
  WHERE 
    p_objective_id = ANY(sm.objective_id)
    AND p_investment_id = ANY(sm.investment_id)
    AND p_framing_id = ANY(sm.framing_id)
  ORDER BY 
    -- Prioriza matriz mais específica (menos elementos)
    (COALESCE(array_length(sm.objective_id, 1), 0) + 
     COALESCE(array_length(sm.investment_id, 1), 0) + 
     COALESCE(array_length(sm.framing_id, 1), 0)) ASC,
    -- Depois maior score
    sm.score_number DESC,
    -- Depois mais recente
    sm.created_at DESC
  LIMIT 1;
END;
$$;

-- Função trigger para auto-vincular a matriz de score
CREATE OR REPLACE FUNCTION public.auto_link_score_matrix()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matrix_id uuid;
  v_score integer;
BEGIN
  -- Só processa se os 3 campos estiverem preenchidos
  IF NEW.score_objective_id IS NOT NULL 
     AND NEW.score_investment_id IS NOT NULL 
     AND NEW.score_framing_id IS NOT NULL THEN
    
    -- Busca a matriz correspondente
    SELECT matrix_id, matrix_score 
    INTO v_matrix_id, v_score
    FROM public.find_score_matrix(
      NEW.score_objective_id,
      NEW.score_investment_id,
      NEW.score_framing_id
    );
    
    -- Se encontrou, atualiza os campos
    IF v_matrix_id IS NOT NULL THEN
      NEW.score_matrix_id := v_matrix_id;
      NEW.score := v_score;
    ELSE
      -- Se não encontrou matriz, limpa apenas score_matrix_id e score
      NEW.score_matrix_id := NULL;
      NEW.score := NULL;
    END IF;
  ELSE
    -- Se não tem os 3 campos, limpa score_matrix_id e score
    NEW.score_matrix_id := NULL;
    NEW.score := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar o trigger (remove se já existir)
DROP TRIGGER IF EXISTS trigger_auto_link_score_matrix ON public.clients_people;

CREATE TRIGGER trigger_auto_link_score_matrix
  BEFORE INSERT OR UPDATE OF score_objective_id, score_investment_id, score_framing_id
  ON public.clients_people
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_score_matrix();