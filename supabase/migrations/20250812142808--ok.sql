-- Corrigir função get_dashboard_negocios_aggregated para usar nomes corretos das colunas
CREATE OR REPLACE FUNCTION get_dashboard_negocios_aggregated(
  p_tenant_id UUID,
  p_pipeline_id UUID DEFAULT NULL,
  p_stage_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_responsavel UUID DEFAULT NULL,
  p_data_inicio TIMESTAMP DEFAULT NULL,
  p_data_fim TIMESTAMP DEFAULT NULL,
  p_scores INTEGER[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result JSON;
  metricas_gerais JSON;
  leads_por_estagio JSON;
  leads_por_status JSON;
  motivos_perda JSON;
BEGIN
  -- Log de entrada
  RAISE LOG 'get_dashboard_negocios_aggregated called with tenant_id: %, pipeline_id: %, stage_id: %, status: %, responsavel: %, data_inicio: %, data_fim: %, scores: %', 
    p_tenant_id, p_pipeline_id, p_stage_id, p_status, p_responsavel, p_data_inicio, p_data_fim, p_scores;

  -- Construir query base com filtros
  WITH filtered_leads AS (
    SELECT 
      cl.id,
      cl.valor,
      cl.status,
      cl.created_at,
      cl.responsavel,
      cs.nome as stage_nome,
      cs.ordem as stage_ordem,
      cp.score,
      cmp.nome as motivo_perda_nome
    FROM crm_leads cl
    INNER JOIN crm_stages cs ON cl.stage_id = cs.id
    INNER JOIN crm_pessoas cp ON cl.person_id = cp.id  -- Corrigido: person_id em vez de pessoa_id
    LEFT JOIN crm_motivo_perda cmp ON cl.motivo_perda_id = cmp.id
    WHERE cl.tenant_id = p_tenant_id
      AND (p_pipeline_id IS NULL OR cl.pipeline_id = p_pipeline_id)
      AND (p_stage_id IS NULL OR cl.stage_id = p_stage_id)
      AND (p_status IS NULL OR cl.status = p_status)
      AND (p_responsavel IS NULL OR cl.responsavel = p_responsavel)
      AND (p_data_inicio IS NULL OR cl.created_at >= p_data_inicio)
      AND (p_data_fim IS NULL OR cl.created_at <= p_data_fim)
      AND (
        p_scores IS NULL 
        OR array_length(p_scores, 1) IS NULL 
        OR (
          (0 = ANY(p_scores) AND cp.score IS NULL) 
          OR cp.score = ANY(p_scores)
        )
      )
  ),
  
  -- Métricas gerais
  metricas AS (
    SELECT 
      COUNT(*) as total_leads,
      COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total,
      COUNT(*) FILTER (WHERE status = 'ganho') as leads_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as leads_perdidos,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as leads_em_andamento
    FROM filtered_leads
  ),
  
  -- Leads por estágio
  estagio_stats AS (
    SELECT 
      stage_nome,
      stage_ordem,
      COUNT(*) as count,
      COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total,
      COUNT(*) FILTER (WHERE status = 'ganho') as ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as perdas,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as em_andamento
    FROM filtered_leads
    GROUP BY stage_nome, stage_ordem
    ORDER BY stage_ordem
  ),
  
  -- Leads por status
  status_stats AS (
    SELECT 
      status,
      COUNT(*) as count,
      COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total
    FROM filtered_leads
    GROUP BY status
  ),
  
  -- Motivos de perda
  perda_stats AS (
    SELECT 
      motivo_perda_nome as motivo,
      COUNT(*) as count,
      COALESCE(SUM(COALESCE(valor, 0)), 0) as valor_total
    FROM filtered_leads
    WHERE status = 'perdido' AND motivo_perda_nome IS NOT NULL
    GROUP BY motivo_perda_nome
    ORDER BY count DESC
  )
  
  -- Construir JSON de retorno
  SELECT json_build_object(
    'metricas_gerais', (
      SELECT json_build_object(
        'total_leads', total_leads,
        'valor_total', valor_total,
        'leads_ganhos', leads_ganhos,
        'leads_perdidos', leads_perdidos,
        'leads_em_andamento', leads_em_andamento
      ) FROM metricas
    ),
    'leads_por_estagio', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'stage_nome', stage_nome,
          'stage_ordem', stage_ordem,
          'count', count,
          'valor_total', valor_total,
          'ganhos', ganhos,
          'perdas', perdas,
          'em_andamento', em_andamento
        ) ORDER BY stage_ordem
      ), '[]'::json) FROM estagio_stats
    ),
    'leads_por_status', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'status', status,
          'count', count,
          'valor_total', valor_total
        )
      ), '[]'::json) FROM status_stats
    ),
    'motivos_perda', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'motivo', motivo,
          'count', count,
          'valor_total', valor_total
        ) ORDER BY count DESC
      ), '[]'::json) FROM perda_stats
    )
  ) INTO result;

  RAISE LOG 'get_dashboard_negocios_aggregated completed successfully';
  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in get_dashboard_negocios_aggregated: % %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;