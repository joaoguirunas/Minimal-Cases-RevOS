-- Corrigir a função com estrutura SQL mais simples e sem problemas de CTE
DROP FUNCTION IF EXISTS get_dashboard_negocios_aggregated(uuid, uuid, uuid, text, uuid, timestamp with time zone, timestamp with time zone, integer[]);

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
  total_leads INTEGER;
  valor_total NUMERIC;
  leads_ganhos INTEGER;
  leads_perdidos INTEGER;
  leads_em_andamento INTEGER;
  ticket_medio NUMERIC;
  taxa_conversao NUMERIC;
BEGIN
  -- Log início
  RAISE LOG 'get_dashboard_negocios_aggregated - tenant_id: %', p_tenant_id;

  -- Calcular métricas básicas
  SELECT 
    COUNT(*),
    COALESCE(SUM(cl.valor), 0),
    COUNT(*) FILTER (WHERE cl.status = 'ganho'),
    COUNT(*) FILTER (WHERE cl.status = 'perdido'),
    COUNT(*) FILTER (WHERE cl.status = 'em-andamento')
  INTO 
    total_leads, valor_total, leads_ganhos, leads_perdidos, leads_em_andamento
  FROM crm_leads cl
  INNER JOIN crm_stages cs ON cl.stage_id = cs.id
  INNER JOIN crm_pipelines cp_pipeline ON cl.pipeline_id = cp_pipeline.id
  INNER JOIN crm_pessoas cp_pessoa ON cl.person_id = cp_pessoa.id
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
    );

  -- Calcular ticket médio e taxa de conversão
  IF leads_ganhos > 0 THEN
    ticket_medio := valor_total / leads_ganhos;
  ELSE
    ticket_medio := 0;
  END IF;

  IF total_leads > 0 THEN
    taxa_conversao := (leads_ganhos::numeric / total_leads::numeric) * 100;
  ELSE
    taxa_conversao := 0;
  END IF;

  -- Construir resultado
  SELECT json_build_object(
    'totalLeads', total_leads,
    'valorTotal', valor_total,
    'leadsGanhos', leads_ganhos,
    'leadsPerdidos', leads_perdidos,
    'leadsEmAndamento', leads_em_andamento,
    'ticketMedio', ticket_medio,
    'taxaConversao', taxa_conversao,
    'leadsPorStatus', (
      SELECT COALESCE(json_agg(
        json_build_object('status', status, 'count', count_status)
      ), '[]'::json)
      FROM (
        SELECT 
          cl.status,
          COUNT(*) as count_status
        FROM crm_leads cl
        INNER JOIN crm_stages cs ON cl.stage_id = cs.id
        INNER JOIN crm_pipelines cp_pipeline ON cl.pipeline_id = cp_pipeline.id
        INNER JOIN crm_pessoas cp_pessoa ON cl.person_id = cp_pessoa.id
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
        GROUP BY cl.status
      ) status_counts
    ),
    'leadsPorStage', (
      SELECT COALESCE(json_agg(
        json_build_object('nome', nome, 'pipeline', pipeline_nome, 'count', count_stage)
      ), '[]'::json)
      FROM (
        SELECT 
          cs.nome,
          cp_pipeline.nome as pipeline_nome,
          COUNT(*) as count_stage
        FROM crm_leads cl
        INNER JOIN crm_stages cs ON cl.stage_id = cs.id
        INNER JOIN crm_pipelines cp_pipeline ON cl.pipeline_id = cp_pipeline.id
        INNER JOIN crm_pessoas cp_pessoa ON cl.person_id = cp_pessoa.id
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
        GROUP BY cs.nome, cp_pipeline.nome, cs.ordem
        ORDER BY cs.ordem
      ) stage_counts
    ),
    'motivosPerda', (
      SELECT COALESCE(json_agg(
        json_build_object('nome', nome, 'count', count_motivo)
      ), '[]'::json)
      FROM (
        SELECT 
          cmp.nome,
          COUNT(*) as count_motivo
        FROM crm_leads cl
        INNER JOIN crm_stages cs ON cl.stage_id = cs.id
        INNER JOIN crm_pipelines cp_pipeline ON cl.pipeline_id = cp_pipeline.id
        INNER JOIN crm_pessoas cp_pessoa ON cl.person_id = cp_pessoa.id
        INNER JOIN crm_motivo_perda cmp ON cl.motivo_perda_id = cmp.id
        WHERE cl.tenant_id = p_tenant_id
          AND cl.status = 'perdido'
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
        GROUP BY cmp.nome
        ORDER BY count_motivo DESC
      ) motivo_counts
    )
  ) INTO result;

  RAISE LOG 'get_dashboard_negocios_aggregated - Consulta concluída, total leads: %', total_leads;
    
  RETURN result;
END;
$$;