-- Corrigir a função PostgreSQL para usar search_path seguro e corrigir referências de colunas
DROP FUNCTION IF EXISTS get_dashboard_negocios_aggregated(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMP, TIMESTAMP, INTEGER[]);

CREATE OR REPLACE FUNCTION get_dashboard_negocios_aggregated(
  p_tenant_id UUID,
  p_pipeline_id TEXT DEFAULT NULL,
  p_stage_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_responsavel TEXT DEFAULT NULL,
  p_data_inicio TIMESTAMP DEFAULT NULL,
  p_data_fim TIMESTAMP DEFAULT NULL,
  p_scores INTEGER[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  base_query TEXT;
  where_conditions TEXT := '';
  score_condition TEXT := '';
BEGIN
  -- Construir condições WHERE dinamicamente
  where_conditions := 'WHERE cl.tenant_id = ''' || p_tenant_id || '''';
  
  IF p_pipeline_id IS NOT NULL THEN
    where_conditions := where_conditions || ' AND cl.pipeline_id = ''' || p_pipeline_id || '''';
  END IF;
  
  IF p_stage_id IS NOT NULL THEN
    where_conditions := where_conditions || ' AND cl.stage_id = ''' || p_stage_id || '''';
  END IF;
  
  IF p_status IS NOT NULL THEN
    where_conditions := where_conditions || ' AND cl.status = ''' || p_status || '''';
  END IF;
  
  IF p_responsavel IS NOT NULL THEN
    where_conditions := where_conditions || ' AND cl.responsavel = ''' || p_responsavel || '''';
  END IF;
  
  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL THEN
    where_conditions := where_conditions || ' AND cl.created_at >= ''' || p_data_inicio || ''' AND cl.created_at <= ''' || p_data_fim || '''';
  END IF;
  
  -- Condição para scores (incluindo NULL quando 0 está presente)
  IF p_scores IS NOT NULL AND array_length(p_scores, 1) > 0 THEN
    IF 0 = ANY(p_scores) THEN
      -- Se 0 está presente, incluir NULL e outros scores válidos
      score_condition := ' AND (cp_pessoa.score IS NULL';
      IF array_length(array_remove(p_scores, 0), 1) > 0 THEN
        score_condition := score_condition || ' OR cp_pessoa.score = ANY(ARRAY[' || array_to_string(array_remove(p_scores, 0), ',') || '])';
      END IF;
      score_condition := score_condition || ')';
    ELSE
      -- Apenas scores válidos
      score_condition := ' AND cp_pessoa.score = ANY(ARRAY[' || array_to_string(p_scores, ',') || '])';
    END IF;
    where_conditions := where_conditions || score_condition;
  END IF;

  -- Query principal com agregações usando as colunas corretas
  base_query := '
    WITH dashboard_data AS (
      SELECT 
        cl.id,
        cl.valor,
        cl.status,
        cl.created_at,
        cs.nome as stage_nome,
        cs.ordem as stage_ordem,
        cp.nome as pipeline_nome,
        cp_pessoa.score,
        cmp.nome as motivo_perda
      FROM public.crm_leads cl
      INNER JOIN public.crm_stages cs ON cl.stage_id = cs.id
      INNER JOIN public.crm_pipelines cp ON cl.pipeline_id = cp.id
      INNER JOIN public.crm_pessoas cp_pessoa ON cl.pessoa_id = cp_pessoa.id
      LEFT JOIN public.crm_motivo_perda cmp ON cl.motivo_perda_id = cmp.id
      ' || where_conditions || '
    ),
    metricas_gerais AS (
      SELECT 
        COUNT(*) as total_leads,
        COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total,
        COUNT(*) FILTER (WHERE status = ''ganho'') as leads_ganhos,
        COUNT(*) FILTER (WHERE status = ''perdido'') as leads_perdidos,
        COUNT(*) FILTER (WHERE status = ''em-andamento'') as leads_em_andamento
      FROM dashboard_data
    ),
    leads_por_estagio AS (
      SELECT 
        stage_nome,
        stage_ordem,
        COUNT(*) as count,
        COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total,
        COUNT(*) FILTER (WHERE status = ''ganho'') as ganhos,
        COUNT(*) FILTER (WHERE status = ''perdido'') as perdas,
        COUNT(*) FILTER (WHERE status = ''em-andamento'') as em_andamento
      FROM dashboard_data
      GROUP BY stage_nome, stage_ordem
      ORDER BY stage_ordem
    ),
    leads_por_status AS (
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total
      FROM dashboard_data
      GROUP BY status
    ),
    motivos_perda AS (
      SELECT 
        motivo_perda as motivo,
        COUNT(*) as count,
        COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total
      FROM dashboard_data
      WHERE status = ''perdido'' AND motivo_perda IS NOT NULL
      GROUP BY motivo_perda
      ORDER BY COUNT(*) DESC
    )
    SELECT json_build_object(
      ''metricas_gerais'', (SELECT row_to_json(mg) FROM metricas_gerais mg),
      ''leads_por_estagio'', (SELECT COALESCE(json_agg(lpe ORDER BY lpe.stage_ordem), ''[]''::json) FROM leads_por_estagio lpe),
      ''leads_por_status'', (SELECT COALESCE(json_agg(lps), ''[]''::json) FROM leads_por_status lps),
      ''motivos_perda'', (SELECT COALESCE(json_agg(mp), ''[]''::json) FROM motivos_perda mp)
    ) as result
  ';

  -- Executar a query
  EXECUTE base_query INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;