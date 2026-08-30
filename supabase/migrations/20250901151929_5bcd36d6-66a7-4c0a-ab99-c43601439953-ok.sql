-- Criar função RPC para dashboard de agendamentos sem limitações
CREATE OR REPLACE FUNCTION public.get_dashboard_agendamentos_aggregated(
  p_tenant_id uuid,
  p_data_inicio timestamp with time zone DEFAULT NULL,
  p_data_fim timestamp with time zone DEFAULT NULL,
  p_vendedor uuid DEFAULT NULL,
  p_scores integer[] DEFAULT NULL
)
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

  -- Query principal com agregação de dados de agendamentos
  WITH leads_periodo AS (
    SELECT 
      cl.id,
      cl.created_at,
      cp.score
    FROM crm_leads cl
    INNER JOIN crm_pessoas cp ON cl.person_id = cp.id
    WHERE cl.tenant_id = p_tenant_id
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
  
  agendamentos_dados AS (
    SELECT 
      ca.id,
      ca.negocio_id,
      ca.usuario_id,
      ca.data,
      ca.hora_inicio,
      ca.hora_fim,
      ca.status,
      ca.observacoes,
      cu.nome as usuario_nome,
      cl.created_at as lead_created_at,
      cp.nome as pessoa_nome,
      cp.score
    FROM crm_agendamentos ca
    LEFT JOIN crm_usuarios cu ON ca.usuario_id = cu.id
    LEFT JOIN crm_leads cl ON ca.negocio_id = cl.id
    LEFT JOIN crm_pessoas cp ON cl.person_id = cp.id
    WHERE ca.tenant_id = p_tenant_id
      AND (p_vendedor IS NULL OR ca.usuario_id = p_vendedor)
      AND EXISTS (
        SELECT 1 FROM leads_periodo lp 
        WHERE lp.id = ca.negocio_id
      )
  ),
  
  reunioes AS (
    SELECT * FROM agendamentos_dados 
    WHERE status != 'bloqueio manual'
  ),
  
  bloqueios_manuais AS (
    SELECT * FROM agendamentos_dados 
    WHERE status = 'bloqueio manual'
  ),
  
  metricas_gerais AS (
    SELECT 
      (SELECT COUNT(*) FROM reunioes) as total_reunioes,
      (SELECT COUNT(*) FROM bloqueios_manuais) as total_bloqueios_manuais,
      (SELECT COUNT(*) FROM reunioes WHERE status = 'compareceu') as reunioes_compareceu,
      (SELECT COUNT(*) FROM reunioes WHERE status = 'não compareceu') as reunioes_nao_compareceu,
      (SELECT COUNT(*) FROM leads_periodo) as total_leads,
      (SELECT COUNT(DISTINCT negocio_id) FROM reunioes) as leads_com_reunioes
  ),
  
  ranking_vendedores AS (
    SELECT 
      usuario_id,
      usuario_nome,
      COUNT(*) as reunioes_marcadas,
      COUNT(*) FILTER (WHERE status = 'compareceu') as reunioes_compareceu,
      CASE WHEN COUNT(*) > 0 
        THEN (COUNT(*) FILTER (WHERE status = 'compareceu')::numeric / COUNT(*)::numeric) * 100 
        ELSE 0 END as taxa_comparecimento
    FROM reunioes
    WHERE usuario_id IS NOT NULL AND usuario_nome IS NOT NULL
    GROUP BY usuario_id, usuario_nome
    ORDER BY reunioes_marcadas DESC
  ),
  
  bloqueios_por_vendedor AS (
    SELECT 
      usuario_id,
      usuario_nome,
      COUNT(*) as total_bloqueios,
      json_agg(
        json_build_object(
          'data', data,
          'horaInicio', hora_inicio,
          'horaFim', hora_fim,
          'observacoes', observacoes
        )
      ) as bloqueios
    FROM bloqueios_manuais
    WHERE usuario_id IS NOT NULL AND usuario_nome IS NOT NULL
    GROUP BY usuario_id, usuario_nome
    ORDER BY total_bloqueios DESC
  ),
  
  status_reunioes AS (
    SELECT 
      status,
      COUNT(*) as count,
      CASE WHEN (SELECT total_reunioes FROM metricas_gerais) > 0 
        THEN (COUNT(*)::numeric / (SELECT total_reunioes FROM metricas_gerais)::numeric) * 100 
        ELSE 0 END as percentage
    FROM reunioes
    GROUP BY status
    HAVING COUNT(*) > 0
  ),
  
  evolucao_agendamentos AS (
    SELECT 
      TO_CHAR(DATE_TRUNC('day', r.data::date), 'YYYY-MM-DD') as data,
      COUNT(*) as reunioes,
      COUNT(*) FILTER (WHERE r.status = 'agendado') as agendado,
      COUNT(*) FILTER (WHERE r.status = 'compareceu') as compareceu,
      COUNT(*) FILTER (WHERE r.status = 'não compareceu') as nao_compareceu,
      COUNT(*) FILTER (WHERE r.status = 'cancelado') as cancelado,
      COUNT(*) as total
    FROM reunioes r
    GROUP BY TO_CHAR(DATE_TRUNC('day', r.data::date), 'YYYY-MM-DD')
    
    UNION ALL
    
    SELECT 
      TO_CHAR(DATE_TRUNC('day', lp.created_at), 'YYYY-MM-DD') as data,
      0 as reunioes,
      0 as agendado,
      0 as compareceu,
      0 as nao_compareceu,
      0 as cancelado,
      0 as total
    FROM leads_periodo lp
    GROUP BY TO_CHAR(DATE_TRUNC('day', lp.created_at), 'YYYY-MM-DD')
  ),
  
  evolucao_final AS (
    SELECT 
      data,
      SUM(reunioes) as reunioes,
      COUNT(DISTINCT CASE WHEN data IN (
        SELECT DISTINCT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') 
        FROM leads_periodo
      ) THEN data END) * (
        SELECT COUNT(*) FROM leads_periodo 
        WHERE TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') = ea.data
      ) as total_leads,
      SUM(agendado) as agendado,
      SUM(compareceu) as compareceu,
      SUM(nao_compareceu) as nao_compareceu,
      SUM(cancelado) as cancelado,
      SUM(total) as total
    FROM evolucao_agendamentos ea
    GROUP BY data
    ORDER BY data
  )
  
  -- Construir resultado final
  SELECT json_build_object(
    'totalReunioes', (SELECT total_reunioes FROM metricas_gerais),
    'totalBloqueiosManuais', (SELECT total_bloqueios_manuais FROM metricas_gerais),
    'reunioesCompareceu', (SELECT reunioes_compareceu FROM metricas_gerais),
    'reunioesNaoCompareceu', (SELECT reunioes_nao_compareceu FROM metricas_gerais),
    'taxaComparecimento', (
      SELECT CASE WHEN total_reunioes > 0 
        THEN (reunioes_compareceu::numeric / total_reunioes::numeric) * 100 
        ELSE 0 END 
      FROM metricas_gerais
    ),
    'totalLeads', (SELECT total_leads FROM metricas_gerais),
    'percentualLeadsComReunioes', (
      SELECT CASE WHEN total_leads > 0 
        THEN (leads_com_reunioes::numeric / total_leads::numeric) * 100 
        ELSE 0 END 
      FROM metricas_gerais
    ),
    'rankingVendedoresMarcadas', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'vendedor', usuario_nome,
          'vendedorId', usuario_id,
          'reunioesMarcadas', reunioes_marcadas,
          'reunioesCompareceu', reunioes_compareceu,
          'taxaComparecimento', taxa_comparecimento
        )
      ), '[]'::json)
      FROM ranking_vendedores
    ),
    'bloqueiosPorVendedor', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'vendedor', usuario_nome,
          'vendedorId', usuario_id,
          'totalBloqueios', total_bloqueios,
          'bloqueios', bloqueios
        )
      ), '[]'::json)
      FROM bloqueios_por_vendedor
    ),
    'statusReunioes', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'status', status,
          'count', count,
          'percentage', percentage
        )
      ), '[]'::json)
      FROM status_reunioes
    ),
    'evolucaoAgendamentos', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'data', data,
          'reunioes', reunioes,
          'totalLeads', total_leads,
          'agendado', agendado,
          'compareceu', compareceu,
          'naoCompareceu', nao_compareceu,
          'cancelado', cancelado,
          'total', total
        )
      ), '[]'::json)
      FROM evolucao_final
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;