-- Aumentar timeout e otimizar função get_dashboard_negocios_aggregated
CREATE OR REPLACE FUNCTION public.get_dashboard_negocios_aggregated(
  p_tenant_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_data_inicio timestamp with time zone DEFAULT NULL,
  p_data_fim timestamp with time zone DEFAULT NULL,
  p_scores integer[] DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
SET search_path = public
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Log de início
  RAISE LOG 'get_dashboard_negocios_aggregated - tenant_id: %, timeout: 300s', p_tenant_id;

  -- Validação básica
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  -- Query otimizada com menos JOINs e melhor indexação
  WITH leads_base AS (
    SELECT 
      cl.id,
      cl.valor,
      cl.status,
      cl.created_at,
      cl.responsavel,
      cl.stage_id,
      cl.pipeline_id,
      cp.score
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
  
  -- Agregações básicas
  metricas_gerais AS (
    SELECT 
      COUNT(*) as total_negocios,
      COUNT(*) FILTER (WHERE status = 'ganho') as negocios_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as negocios_perdidos,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as negocios_em_andamento,
      COALESCE(SUM(valor), 0) as valor_total,
      COALESCE(SUM(CASE WHEN status = 'ganho' THEN valor ELSE 0 END), 0) as valor_ganho,
      COALESCE(AVG(valor), 0) as ticket_medio
    FROM leads_base
  ),
  
  -- Dados por pipeline
  dados_pipeline AS (
    SELECT 
      cs.nome as pipeline_nome,
      COUNT(lb.id) as total_leads,
      COUNT(*) FILTER (WHERE lb.status = 'ganho') as ganhos,
      COUNT(*) FILTER (WHERE lb.status = 'perdido') as perdidos,
      COALESCE(SUM(lb.valor), 0) as valor_total
    FROM leads_base lb
    LEFT JOIN crm_stages cs2 ON lb.stage_id = cs2.id
    LEFT JOIN crm_pipelines cs ON cs2.pipeline_id = cs.id
    GROUP BY cs.nome
  ),
  
  -- Dados por etapa
  dados_etapa AS (
    SELECT 
      cs.nome as etapa_nome,
      cs.ordem,
      COUNT(lb.id) as total_leads,
      COALESCE(SUM(lb.valor), 0) as valor_total
    FROM leads_base lb
    LEFT JOIN crm_stages cs ON lb.stage_id = cs.id
    GROUP BY cs.nome, cs.ordem
    ORDER BY cs.ordem
  )
  
  -- Construir resultado final
  SELECT json_build_object(
    'metricas_gerais', (
      SELECT json_build_object(
        'total_negocios', total_negocios,
        'negocios_ganhos', negocios_ganhos,
        'negocios_perdidos', negocios_perdidos,
        'negocios_em_andamento', negocios_em_andamento,
        'valor_total', valor_total,
        'valor_ganho', valor_ganho,
        'ticket_medio', ticket_medio,
        'taxa_conversao', CASE WHEN total_negocios > 0 THEN (negocios_ganhos::numeric / total_negocios::numeric) * 100 ELSE 0 END
      ) FROM metricas_gerais
    ),
    'dados_pipeline', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'pipeline_nome', pipeline_nome,
          'total_leads', total_leads,
          'ganhos', ganhos,
          'perdidos', perdidos,
          'valor_total', valor_total
        )
      ), '[]'::json) FROM dados_pipeline
    ),
    'dados_etapa', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'etapa_nome', etapa_nome,
          'ordem', ordem,
          'total_leads', total_leads,
          'valor_total', valor_total
        ) ORDER BY ordem
      ), '[]'::json) FROM dados_etapa
    )
  ) INTO v_result;

  RAISE LOG 'get_dashboard_negocios_aggregated - Consulta concluída com sucesso';
  RETURN v_result;
END;
$function$;

-- Otimizar função get_dashboard_leads_evolucao com timeout maior
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_evolucao(
  p_tenant_id uuid, 
  p_pipeline_id uuid DEFAULT NULL::uuid, 
  p_stage_id uuid DEFAULT NULL::uuid, 
  p_status text DEFAULT NULL::text, 
  p_responsavel uuid DEFAULT NULL::uuid, 
  p_data_inicio timestamp without time zone DEFAULT NULL::timestamp without time zone, 
  p_data_fim timestamp without time zone DEFAULT NULL::timestamp without time zone, 
  p_scores integer[] DEFAULT NULL::integer[]
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
SET search_path = public
AS $function$
DECLARE
  result JSON;
  total_dias integer;
  granularidade text;
BEGIN
  -- Log de início
  RAISE LOG 'get_dashboard_leads_evolucao - tenant_id: %, timeout: 300s', p_tenant_id;

  -- Determinar granularidade baseada no período
  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL THEN
    total_dias := p_data_fim::date - p_data_inicio::date;
    
    IF total_dias <= 31 THEN
      granularidade := 'daily';
    ELSIF total_dias <= 93 THEN
      granularidade := 'weekly';
    ELSE
      granularidade := 'monthly';
    END IF;
  ELSE
    -- Padrão para últimos 30 dias se não especificado
    granularidade := 'monthly';
    IF p_data_inicio IS NULL THEN
      p_data_inicio := (CURRENT_DATE - INTERVAL '30 days')::timestamp;
    END IF;
    IF p_data_fim IS NULL THEN
      p_data_fim := CURRENT_TIMESTAMP;
    END IF;
  END IF;

  -- Query otimizada com menor complexidade
  WITH base_leads_otimizada AS (
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
      AND cl.created_at >= p_data_inicio
      AND cl.created_at <= p_data_fim
      AND (
        p_scores IS NULL 
        OR array_length(p_scores, 1) IS NULL 
        OR (
          (0 = ANY(p_scores) AND cp.score IS NULL) 
          OR cp.score = ANY(p_scores)
        )
      )
  ),
  
  agregacao_final AS (
    SELECT 
      periodo,
      COUNT(*) as total_leads,
      COUNT(CASE WHEN status = 'ganho' THEN 1 END) as leads_ganhos,
      COUNT(CASE WHEN status = 'perdido' THEN 1 END) as leads_perdidos,
      COUNT(CASE WHEN status = 'em-andamento' THEN 1 END) as leads_em_andamento,
      COALESCE(SUM(valor), 0) as valor_total
    FROM base_leads_otimizada
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
  FROM agregacao_final;

  RAISE LOG 'get_dashboard_leads_evolucao - Consulta concluída com sucesso';
  RETURN result;
END;
$function$;

-- Otimizar função get_dashboard_leads_conversao com timeout maior  
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_conversao(
  p_tenant_id uuid, 
  p_pipeline_id uuid DEFAULT NULL::uuid, 
  p_stage_id uuid DEFAULT NULL::uuid, 
  p_status text DEFAULT NULL::text, 
  p_responsavel uuid DEFAULT NULL::uuid, 
  p_data_inicio timestamp without time zone DEFAULT NULL::timestamp without time zone, 
  p_data_fim timestamp without time zone DEFAULT NULL::timestamp without time zone, 
  p_scores integer[] DEFAULT NULL::integer[]
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
SET search_path = public
AS $function$
DECLARE
  result JSON;
  total_dias integer;
  granularidade text;
BEGIN
  -- Log de início
  RAISE LOG 'get_dashboard_leads_conversao - tenant_id: %, timeout: 300s', p_tenant_id;

  -- Determinar granularidade baseada no período
  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL THEN
    total_dias := p_data_fim::date - p_data_inicio::date;
    
    IF total_dias <= 93 THEN
      granularidade := 'weekly';
    ELSE
      granularidade := 'monthly';
    END IF;
  ELSE
    granularidade := 'weekly';
    IF p_data_inicio IS NULL THEN
      p_data_inicio := (CURRENT_DATE - INTERVAL '30 days')::timestamp;
    END IF;
    IF p_data_fim IS NULL THEN
      p_data_fim := CURRENT_TIMESTAMP;
    END IF;
  END IF;

  -- Query simplificada para melhor performance
  WITH leads_com_agendamentos AS (
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
      AND cl.created_at >= p_data_inicio
      AND cl.created_at <= p_data_fim
      AND (
        p_scores IS NULL 
        OR array_length(p_scores, 1) IS NULL 
        OR (
          (0 = ANY(p_scores) AND cp.score IS NULL) 
          OR cp.score = ANY(p_scores)
        )
      )
  ),
  
  metricas_resumo AS (
    SELECT 
      COUNT(*) as total_leads,
      SUM(tem_agendamento) as total_agendamentos,
      COALESCE(SUM(valor), 0) as valor_total,
      COALESCE(SUM(CASE WHEN tem_agendamento = 1 THEN valor ELSE 0 END), 0) as valor_com_agendamentos,
      CASE WHEN COUNT(*) > 0 THEN (SUM(tem_agendamento)::numeric / COUNT(*)) * 100 ELSE 0 END as percentual_geral
    FROM leads_com_agendamentos
  ),
  
  dados_periodo AS (
    SELECT 
      periodo,
      COUNT(*) as total_leads_periodo,
      SUM(tem_agendamento) as agendamentos_periodo,
      CASE WHEN COUNT(*) > 0 THEN (SUM(tem_agendamento)::numeric / COUNT(*)) * 100 ELSE 0 END as percentual_periodo
    FROM leads_com_agendamentos
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
      ) FROM metricas_resumo
    ),
    'dados', COALESCE((
      SELECT json_agg(
        json_build_object(
          'periodo', periodo,
          'totalLeads', total_leads_periodo,
          'agendamentos', agendamentos_periodo,
          'percentual', percentual_periodo
        ) ORDER BY periodo
      ) FROM dados_periodo
    ), '[]'::json),
    'granularidade', granularidade
  ) INTO result;

  RAISE LOG 'get_dashboard_leads_conversao - Consulta concluída com sucesso';
  RETURN result;
END;
$function$;