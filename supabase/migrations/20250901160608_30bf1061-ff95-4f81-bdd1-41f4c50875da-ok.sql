-- Remover completamente limitações de 1000 leads e garantir que todas as funções RPC não tenham limitações

-- Primeiro, vamos configurar para não ter limites nas consultas PostgREST
-- Atualizar função get_dashboard_negocios_aggregated para garantir que não há limitações
CREATE OR REPLACE FUNCTION public.get_dashboard_negocios_aggregated(
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
SET statement_timeout TO '300s'
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Log de início
  RAISE LOG 'get_dashboard_negocios_aggregated - tenant_id: %, REMOVENDO TODAS AS LIMITAÇÕES', p_tenant_id;

  -- Validação básica
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  -- Query COMPLETA sem nenhuma limitação - buscar TODOS os leads
  WITH leads_completos AS (
    SELECT 
      cl.id,
      cl.valor,
      cl.status,
      cl.created_at,
      cl.responsavel,
      cl.stage_id,
      cl.pipeline_id,
      cp.score,
      cs.nome as stage_nome,
      cs.ordem as stage_ordem,
      cp2.nome as pipeline_nome,
      mp.nome as motivo_perda_nome
    FROM crm_leads cl
    INNER JOIN crm_pessoas cp ON cl.person_id = cp.id
    LEFT JOIN crm_stages cs ON cl.stage_id = cs.id
    LEFT JOIN crm_pipelines cp2 ON cl.pipeline_id = cp2.id
    LEFT JOIN crm_motivo_perda mp ON cl.motivo_perda_id = mp.id
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
  
  -- Métricas principais
  metricas_principais AS (
    SELECT 
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE status = 'ganho') as leads_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as leads_perdidos,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as leads_em_andamento,
      COALESCE(SUM(valor), 0) as valor_total,
      COALESCE(SUM(CASE WHEN status = 'ganho' THEN valor ELSE 0 END), 0) as valor_ganho,
      COALESCE(AVG(valor), 0) as ticket_medio,
      COUNT(*) FILTER (WHERE status = 'ganho')::numeric / 
        NULLIF(COUNT(*)::numeric, 0) * 100 as taxa_conversao
    FROM leads_completos
  ),
  
  -- Leads por estágio (ordenado por pipeline)
  leads_por_estagio AS (
    SELECT 
      stage_nome as nome,
      pipeline_nome,
      stage_ordem as ordem,
      COUNT(*) as total,
      COALESCE(SUM(valor), 0) as valor_total,
      COUNT(*)::numeric / (SELECT total_leads FROM metricas_principais)::numeric * 100 as percentual,
      COALESCE(SUM(valor), 0) / NULLIF((SELECT valor_total FROM metricas_principais), 0) * 100 as percentual_valor
    FROM leads_completos
    WHERE stage_nome IS NOT NULL
    GROUP BY stage_nome, pipeline_nome, stage_ordem
    ORDER BY stage_ordem
  ),
  
  -- Leads por status
  leads_por_status AS (
    SELECT 
      status,
      COUNT(*) as total,
      COALESCE(SUM(valor), 0) as valor_total,
      COUNT(*)::numeric / (SELECT total_leads FROM metricas_principais)::numeric * 100 as percentual,
      COALESCE(SUM(valor), 0) / NULLIF((SELECT valor_total FROM metricas_principais), 0) * 100 as percentual_valor
    FROM leads_completos
    GROUP BY status
  ),
  
  -- Motivos de perda
  motivos_perda AS (
    SELECT 
      motivo_perda_nome as motivo,
      COUNT(*) as total,
      COALESCE(SUM(valor), 0) as valor_total,
      COUNT(*)::numeric / NULLIF((SELECT leads_perdidos FROM metricas_principais)::numeric, 0) * 100 as percentual
    FROM leads_completos
    WHERE status = 'perdido' AND motivo_perda_nome IS NOT NULL
    GROUP BY motivo_perda_nome
    ORDER BY COUNT(*) DESC
  )
  
  -- Construir resultado COMPLETO
  SELECT json_build_object(
    'totalLeads', (SELECT total_leads FROM metricas_principais),
    'leadsGanhos', (SELECT leads_ganhos FROM metricas_principais),
    'leadsPerdidos', (SELECT leads_perdidos FROM metricas_principais),
    'leadsEmAndamento', (SELECT leads_em_andamento FROM metricas_principais),
    'valorTotal', (SELECT valor_total FROM metricas_principais),
    'valorGanho', (SELECT valor_ganho FROM metricas_principais),
    'ticketMedio', (SELECT ticket_medio FROM metricas_principais),
    'taxaConversao', (SELECT taxa_conversao FROM metricas_principais),
    'leadsPorEstagio', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'nome', nome,
          'pipeline', pipeline_nome,
          'ordem', ordem,
          'count', total,
          'valor_total', valor_total,
          'percentual', percentual,
          'percentual_valor', percentual_valor
        ) ORDER BY ordem
      ), '[]'::json)
      FROM leads_por_estagio
    ),
    'leadsPorStatus', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'status', status,
          'count', total,
          'valor_total', valor_total,
          'percentual', percentual,
          'percentual_valor', percentual_valor
        )
      ), '[]'::json)
      FROM leads_por_status
    ),
    'motivosPerda', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'motivo', motivo,
          'count', total,
          'valor_total', valor_total,
          'percentual', percentual
        )
      ), '[]'::json)
      FROM motivos_perda
    )
  ) INTO v_result;

  RAISE LOG 'get_dashboard_negocios_aggregated - Total de leads processados: %', (SELECT total_leads FROM metricas_principais);
  RETURN v_result;
END;
$$;