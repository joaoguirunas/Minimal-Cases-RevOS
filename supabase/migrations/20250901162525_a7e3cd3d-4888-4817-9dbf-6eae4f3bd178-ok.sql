-- Clean up all existing versions of the function to resolve overloading conflicts
DROP FUNCTION IF EXISTS get_dashboard_negocios_aggregated(uuid, uuid, uuid, text, uuid, timestamp without time zone, timestamp without time zone, integer[]);
DROP FUNCTION IF EXISTS get_dashboard_negocios_aggregated(uuid, uuid, uuid, text, uuid, timestamp with time zone, timestamp with time zone, integer[]);

-- Create a single, clean version with proper parameter types
CREATE OR REPLACE FUNCTION get_dashboard_negocios_aggregated(
  p_tenant_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_data_inicio timestamp with time zone DEFAULT NULL,
  p_data_fim timestamp with time zone DEFAULT NULL,
  p_scores integer[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  -- Log início
  RAISE LOG 'get_dashboard_negocios_aggregated - tenant_id: %', p_tenant_id;

  WITH leads_filtrados AS (
    SELECT 
      cl.id,
      cl.valor,
      cl.status,
      cl.created_at,
      cl.responsavel,
      cs.nome as stage_nome,
      cs.pipeline_id,
      cs.ordem as stage_ordem,
      cp_pipeline.nome as pipeline_nome,
      cp_pessoa.score,
      cmp.nome as motivo_perda_nome
    FROM crm_leads cl
    INNER JOIN crm_stages cs ON cl.stage_id = cs.id
    INNER JOIN crm_pipelines cp_pipeline ON cl.pipeline_id = cp_pipeline.id
    INNER JOIN crm_pessoas cp_pessoa ON cl.person_id = cp_pessoa.id
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
          (0 = ANY(p_scores) AND cp_pessoa.score IS NULL) 
          OR cp_pessoa.score = ANY(p_scores)
        )
      )
  ),
  
  metricas_basicas AS (
    SELECT 
      COUNT(*) as total_leads,
      COALESCE(SUM(valor), 0) as valor_total,
      COUNT(*) FILTER (WHERE status = 'ganho') as leads_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as leads_perdidos,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as leads_em_andamento
    FROM leads_filtrados
  ),
  
  leads_por_status AS (
    SELECT 
      status,
      COUNT(*) as count
    FROM leads_filtrados
    GROUP BY status
  ),
  
  leads_por_stage AS (
    SELECT 
      stage_nome as nome,
      pipeline_nome,
      COUNT(*) as count
    FROM leads_filtrados
    GROUP BY stage_nome, pipeline_nome
    ORDER BY MIN(stage_ordem)
  ),
  
  motivos_perda AS (
    SELECT 
      motivo_perda_nome as nome,
      COUNT(*) as count
    FROM leads_filtrados
    WHERE status = 'perdido' AND motivo_perda_nome IS NOT NULL
    GROUP BY motivo_perda_nome
    ORDER BY count DESC
  )
  
  SELECT json_build_object(
    'totalLeads', (SELECT total_leads FROM metricas_basicas),
    'valorTotal', (SELECT valor_total FROM metricas_basicas),
    'leadsGanhos', (SELECT leads_ganhos FROM metricas_basicas),
    'leadsPerdidos', (SELECT leads_perdidos FROM metricas_basicas),
    'leadsEmAndamento', (SELECT leads_em_andamento FROM metricas_basicas),
    'ticketMedio', (
      SELECT CASE WHEN leads_ganhos > 0 
        THEN valor_total / leads_ganhos 
        ELSE 0 END 
      FROM metricas_basicas
    ),
    'taxaConversao', (
      SELECT CASE WHEN total_leads > 0 
        THEN (leads_ganhos::numeric / total_leads::numeric) * 100 
        ELSE 0 END 
      FROM metricas_basicas
    ),
    'leadsPorStatus', (
      SELECT COALESCE(json_agg(
        json_build_object('status', status, 'count', count)
      ), '[]'::json)
      FROM leads_por_status
    ),
    'leadsPorStage', (
      SELECT COALESCE(json_agg(
        json_build_object('nome', nome, 'pipeline', pipeline_nome, 'count', count)
      ), '[]'::json)
      FROM leads_por_stage
    ),
    'motivosPerda', (
      SELECT COALESCE(json_agg(
        json_build_object('nome', nome, 'count', count)
      ), '[]'::json)
      FROM motivos_perda
    )
  ) INTO result;

  RAISE LOG 'get_dashboard_negocios_aggregated - Consulta concluída, total leads: %', 
    (SELECT total_leads FROM metricas_basicas);
    
  RETURN result;
END;
$$;