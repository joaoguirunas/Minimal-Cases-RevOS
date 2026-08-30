-- Função para Dashboard de Evolução de Leads
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_evolucao(
  p_tenant_id uuid,
  p_pipeline_id uuid DEFAULT NULL::uuid,
  p_stage_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT NULL::text,
  p_responsavel uuid DEFAULT NULL::uuid,
  p_data_inicio timestamp without time zone DEFAULT NULL::timestamp without time zone,
  p_data_fim timestamp without time zone DEFAULT NULL::timestamp without time zone,
  p_scores integer[] DEFAULT NULL::integer[]
) 
RETURNS json
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  total_dias integer;
  granularidade text;
BEGIN
  -- Log de início
  RAISE LOG 'get_dashboard_leads_evolucao - tenant_id: %, filters aplicados', p_tenant_id;

  -- Determinar granularidade baseada no período
  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL THEN
    total_dias := p_data_fim::date - p_data_inicio::date;
    
    IF total_dias <= 31 THEN
      granularidade := 'daily';
    ELSIF total_dias <= 93 THEN  -- ~3 meses
      granularidade := 'weekly';
    ELSE
      granularidade := 'monthly';
    END IF;
  ELSE
    -- Padrão para últimos 30 dias
    granularidade := 'daily';
  END IF;

  -- Query principal com agregação baseada na granularidade
  WITH base_leads AS (
    SELECT 
      cl.id,
      cl.status,
      cl.created_at,
      COALESCE(cl.valor, 0) as valor,
      cp.score,
      CASE 
        WHEN granularidade = 'daily' THEN 
          TO_CHAR(cl.created_at, 'YYYY-MM-DD')
        WHEN granularidade = 'weekly' THEN 
          TO_CHAR(DATE_TRUNC('week', cl.created_at), 'YYYY-MM-DD')
        ELSE 
          TO_CHAR(DATE_TRUNC('month', cl.created_at), 'YYYY-MM')
      END as periodo
    FROM crm_leads cl
    INNER JOIN crm_pessoas cp ON cl.person_id = cp.id
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
  
  agregacao_por_periodo AS (
    SELECT 
      periodo,
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE status = 'ganho') as leads_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as leads_perdidos,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as leads_em_andamento,
      COALESCE(SUM(valor), 0) as valor_total
    FROM base_leads
    GROUP BY periodo
    ORDER BY periodo
  )
  
  SELECT json_build_object(
    'dados', COALESCE(json_agg(
      json_build_object(
        'periodo', periodo,
        'totalLeads', total_leads,
        'leadsGanhos', leads_ganhos,
        'leadsPerdidos', leads_perdidos,
        'leadsEmAndamento', leads_em_andamento,
        'valorTotal', valor_total
      ) ORDER BY periodo
    ), '[]'::json),
    'granularidade', granularidade
  ) INTO result
  FROM agregacao_por_periodo;

  RAISE LOG 'get_dashboard_leads_evolucao - Consulta concluída com sucesso';
  RETURN result;
END;
$function$;

-- Função para Dashboard de Conversão Leads → Agendamentos
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_conversao(
  p_tenant_id uuid,
  p_pipeline_id uuid DEFAULT NULL::uuid,
  p_stage_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT NULL::text,
  p_responsavel uuid DEFAULT NULL::uuid,
  p_data_inicio timestamp without time zone DEFAULT NULL::timestamp without time zone,
  p_data_fim timestamp without time zone DEFAULT NULL::timestamp without time zone,
  p_scores integer[] DEFAULT NULL::integer[]
) 
RETURNS json
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  total_dias integer;
  granularidade text;
BEGIN
  -- Log de início
  RAISE LOG 'get_dashboard_leads_conversao - tenant_id: %, filters aplicados', p_tenant_id;

  -- Determinar granularidade baseada no período
  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL THEN
    total_dias := p_data_fim::date - p_data_inicio::date;
    
    IF total_dias <= 93 THEN  -- ~3 meses = semanal
      granularidade := 'weekly';
    ELSE
      granularidade := 'monthly';
    END IF;
  ELSE
    -- Padrão para semanal
    granularidade := 'weekly';
  END IF;

  -- Query principal com leads e agendamentos
  WITH base_leads AS (
    SELECT 
      cl.id,
      cl.status,
      cl.created_at,
      COALESCE(cl.valor, 0) as valor,
      cp.score,
      CASE WHEN EXISTS(
        SELECT 1 FROM crm_agendamentos ca 
        WHERE ca.negocio_id = cl.id AND ca.tenant_id = p_tenant_id
      ) THEN 1 ELSE 0 END as tem_agendamento,
      CASE 
        WHEN granularidade = 'weekly' THEN 
          TO_CHAR(DATE_TRUNC('week', cl.created_at), 'YYYY-MM-DD')
        ELSE 
          TO_CHAR(DATE_TRUNC('month', cl.created_at), 'YYYY-MM')
      END as periodo
    FROM crm_leads cl
    INNER JOIN crm_pessoas cp ON cl.person_id = cp.id
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
  
  metricas_gerais AS (
    SELECT 
      COUNT(*) as total_leads,
      SUM(tem_agendamento) as total_agendamentos,
      COALESCE(SUM(valor), 0) as valor_total,
      COALESCE(SUM(CASE WHEN tem_agendamento = 1 THEN valor ELSE 0 END), 0) as valor_com_agendamentos,
      CASE WHEN COUNT(*) > 0 THEN (SUM(tem_agendamento)::numeric / COUNT(*)) * 100 ELSE 0 END as percentual_geral
    FROM base_leads
  ),
  
  agregacao_por_periodo AS (
    SELECT 
      periodo,
      COUNT(*) as total_leads_periodo,
      SUM(tem_agendamento) as agendamentos_periodo,
      CASE WHEN COUNT(*) > 0 THEN (SUM(tem_agendamento)::numeric / COUNT(*)) * 100 ELSE 0 END as percentual_periodo
    FROM base_leads
    GROUP BY periodo
    ORDER BY periodo
  )
  
  SELECT json_build_object(
    'resumo', (
      SELECT json_build_object(
        'totalLeads', total_leads,
        'totalAgendamentos', total_agendamentos,
        'percentualGeral', percentual_geral,
        'valorTotal', valor_total,
        'valorComAgendamentos', valor_com_agendamentos
      ) FROM metricas_gerais
    ),
    'dados', COALESCE((
      SELECT json_agg(
        json_build_object(
          'periodo', periodo,
          'totalLeads', total_leads_periodo,
          'agendamentos', agendamentos_periodo,
          'percentual', percentual_periodo
        ) ORDER BY periodo
      ) FROM agregacao_por_periodo
    ), '[]'::json),
    'granularidade', granularidade
  ) INTO result;

  RAISE LOG 'get_dashboard_leads_conversao - Consulta concluída com sucesso';
  RETURN result;
END;
$function$;