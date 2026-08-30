-- Corrigir a função get_dashboard_campanhas_aggregated que ainda falta search_path
-- Esta função já existe e precisa apenas ter o search_path adicionado

CREATE OR REPLACE FUNCTION public.get_dashboard_campanhas_aggregated(p_tenant_id uuid, p_data_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_data_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_responsavel uuid DEFAULT NULL::uuid, p_scores integer[] DEFAULT NULL::integer[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Validação básica
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  -- Query principal simplificada para evitar agregações aninhadas
  WITH leads_base AS (
    SELECT 
      cl.id as lead_id,
      cl.utm_campaign,
      cl.utm_source,
      cl.utm_medium,
      cl.utm_term,
      cl.utm_content,
      cl.created_at,
      cp.score
    FROM crm_leads cl
    INNER JOIN crm_pessoas cp ON cl.person_id = cp.id
    WHERE cl.tenant_id = p_tenant_id
      AND (p_data_inicio IS NULL OR cl.created_at >= p_data_inicio)
      AND (p_data_fim IS NULL OR cl.created_at <= p_data_fim)
      AND (p_responsavel IS NULL OR cl.responsavel = p_responsavel)
      AND (
        p_scores IS NULL 
        OR array_length(p_scores, 1) IS NULL 
        OR (
          (0 = ANY(p_scores) AND cp.score IS NULL) 
          OR cp.score = ANY(p_scores)
        )
      )
  ),
  
  -- Pré-calcular agendamentos separadamente
  agendamentos_por_lead AS (
    SELECT 
      lb.lead_id,
      lb.utm_campaign,
      lb.utm_source,
      lb.utm_medium,
      lb.utm_term,
      lb.utm_content,
      COUNT(ca.id) as total_agendamentos,
      COUNT(CASE WHEN ca.status = 'compareceu' THEN 1 END) as compareceu,
      COUNT(CASE WHEN ca.status = 'nao_compareceu' THEN 1 END) as nao_compareceu,
      COUNT(CASE WHEN ca.status = 'cancelado' THEN 1 END) as cancelado
    FROM leads_base lb
    LEFT JOIN crm_agendamentos ca ON ca.negocio_id = lb.lead_id AND ca.tenant_id = p_tenant_id
    GROUP BY lb.lead_id, lb.utm_campaign, lb.utm_source, lb.utm_medium, lb.utm_term, lb.utm_content
  ),
  
  -- Agregar por campanhas
  campanhas_agregadas AS (
    SELECT 
      COALESCE(utm_campaign, 'Sem campanha') as utm_campaign,
      COALESCE(utm_source, 'Sem origem') as utm_source,
      COALESCE(utm_medium, 'Sem mídia') as utm_medium,
      COALESCE(utm_term, 'Sem termo') as utm_term,
      COALESCE(utm_content, 'Sem conteúdo') as utm_content,
      COUNT(lead_id) as total_leads,
      SUM(total_agendamentos) as total_agendamentos,
      SUM(compareceu) as compareceu,
      SUM(nao_compareceu) as nao_compareceu,
      SUM(cancelado) as cancelado
    FROM agendamentos_por_lead
    GROUP BY utm_campaign, utm_source, utm_medium, utm_term, utm_content
  ),
  
  -- Dados para gráficos
  chart_utm_campaign AS (
    SELECT 
      COALESCE(utm_campaign, 'Não informado') as periodo,
      COUNT(lead_id) as leads,
      SUM(total_agendamentos) as agendamentos
    FROM agendamentos_por_lead
    GROUP BY utm_campaign
  ),
  
  chart_utm_source AS (
    SELECT 
      COALESCE(utm_source, 'Não informado') as periodo,
      COUNT(lead_id) as leads,
      SUM(total_agendamentos) as agendamentos
    FROM agendamentos_por_lead
    GROUP BY utm_source
  ),
  
  chart_utm_medium AS (
    SELECT 
      COALESCE(utm_medium, 'Não informado') as periodo,
      COUNT(lead_id) as leads,
      SUM(total_agendamentos) as agendamentos
    FROM agendamentos_por_lead
    GROUP BY utm_medium
  ),
  
  chart_utm_term AS (
    SELECT 
      COALESCE(utm_term, 'Não informado') as periodo,
      COUNT(lead_id) as leads,
      SUM(total_agendamentos) as agendamentos
    FROM agendamentos_por_lead
    GROUP BY utm_term
  ),
  
  chart_utm_content AS (
    SELECT 
      COALESCE(utm_content, 'Não informado') as periodo,
      COUNT(lead_id) as leads,
      SUM(total_agendamentos) as agendamentos
    FROM agendamentos_por_lead
    GROUP BY utm_content
  ),
  
  -- Totais gerais
  totais_gerais AS (
    SELECT 
      COUNT(lead_id) as total_leads,
      SUM(total_agendamentos) as total_agendamentos,
      SUM(compareceu) as total_compareceu,
      SUM(compareceu + nao_compareceu + cancelado) as total_interacoes
    FROM agendamentos_por_lead
  )
  
  -- Construir resultado final
  SELECT json_build_object(
    'campanhasTable', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'utm_campaign', utm_campaign,
          'utm_source', utm_source,
          'utm_medium', utm_medium,
          'utm_term', utm_term,
          'utm_content', utm_content,
          'total_leads', total_leads,
          'total_agendamentos', total_agendamentos,
          'compareceu', compareceu,
          'nao_compareceu', nao_compareceu,
          'cancelado', cancelado,
          'taxa_agendamento', 
            CASE WHEN total_leads > 0 
            THEN (total_agendamentos::numeric / total_leads::numeric) * 100 
            ELSE 0 END,
          'taxa_comparecimento', 
            CASE WHEN (compareceu + nao_compareceu + cancelado) > 0 
            THEN (compareceu::numeric / (compareceu + nao_compareceu + cancelado)::numeric) * 100 
            ELSE 0 END
        )
      ), '[]'::json)
      FROM campanhas_agregadas
    ),
    'campanhasChart', json_build_object(
      'utm_campaign', (
        SELECT COALESCE(json_agg(
          json_build_object('periodo', periodo, 'leads', leads, 'agendamentos', agendamentos)
        ), '[]'::json)
        FROM chart_utm_campaign
      ),
      'utm_source', (
        SELECT COALESCE(json_agg(
          json_build_object('periodo', periodo, 'leads', leads, 'agendamentos', agendamentos)
        ), '[]'::json)
        FROM chart_utm_source
      ),
      'utm_medium', (
        SELECT COALESCE(json_agg(
          json_build_object('periodo', periodo, 'leads', leads, 'agendamentos', agendamentos)
        ), '[]'::json)
        FROM chart_utm_medium
      ),
      'utm_term', (
        SELECT COALESCE(json_agg(
          json_build_object('periodo', periodo, 'leads', leads, 'agendamentos', agendamentos)
        ), '[]'::json)
        FROM chart_utm_term
      ),
      'utm_content', (
        SELECT COALESCE(json_agg(
          json_build_object('periodo', periodo, 'leads', leads, 'agendamentos', agendamentos)
        ), '[]'::json)
        FROM chart_utm_content
      )
    ),
    'totalLeads', (SELECT total_leads FROM totais_gerais),
    'totalAgendamentos', (SELECT total_agendamentos FROM totais_gerais),
    'taxaAgendamentoGeral', (
      SELECT CASE WHEN total_leads > 0 
      THEN (total_agendamentos::numeric / total_leads::numeric) * 100 
      ELSE 0 END 
      FROM totais_gerais
    ),
    'taxaComparecimentoGeral', (
      SELECT CASE WHEN total_interacoes > 0 
      THEN (total_compareceu::numeric / total_interacoes::numeric) * 100 
      ELSE 0 END 
      FROM totais_gerais
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;