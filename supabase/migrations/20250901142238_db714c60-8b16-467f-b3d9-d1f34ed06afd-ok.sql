-- Corrigir função get_dashboard_negocios_aggregated para resolver ambiguidade de colunas
CREATE OR REPLACE FUNCTION public.get_dashboard_negocios_aggregated(
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
BEGIN
  -- Log otimizado
  RAISE LOG 'get_dashboard_negocios_aggregated CORRIGIDO - tenant_id: %, filters aplicados', p_tenant_id;

  -- Query otimizada usando agregações diretas COM ALIASES ÚNICOS
  WITH base_leads AS (
    SELECT 
      cl.id,
      COALESCE(cl.valor, 0) as valor,
      cl.status,
      cl.created_at,
      cs.nome as stage_nome,
      cs.ordem as stage_ordem,
      cp.score,
      cmp.nome as motivo_perda_nome
    FROM crm_leads cl
    INNER JOIN crm_stages cs ON cl.stage_id = cs.id
    INNER JOIN crm_pessoas cp ON cl.person_id = cp.id
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
  
  -- Métricas gerais otimizadas
  metricas AS (
    SELECT 
      COUNT(*) as metrica_total_leads,
      COALESCE(SUM(valor), 0) as metrica_valor_total,
      COUNT(*) FILTER (WHERE status = 'ganho') as metrica_leads_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as metrica_leads_perdidos,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as metrica_leads_em_andamento
    FROM base_leads
  ),
  
  -- Leads por estágio otimizado
  estagio_stats AS (
    SELECT 
      stage_nome,
      stage_ordem,
      COUNT(*) as estagio_count,
      COALESCE(SUM(valor), 0) as estagio_valor_total,
      COUNT(*) FILTER (WHERE status = 'ganho') as estagio_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as estagio_perdas,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as estagio_em_andamento
    FROM base_leads
    GROUP BY stage_nome, stage_ordem
    ORDER BY stage_ordem
  ),
  
  -- Leads por status otimizado
  status_stats AS (
    SELECT 
      status,
      COUNT(*) as status_count,
      COALESCE(SUM(valor), 0) as status_valor_total
    FROM base_leads
    GROUP BY status
  ),
  
  -- Motivos de perda otimizado - REMOVIDO LIMITE
  perda_stats AS (
    SELECT 
      motivo_perda_nome as motivo,
      COUNT(*) as perda_count,
      COALESCE(SUM(valor), 0) as perda_valor_total
    FROM base_leads
    WHERE status = 'perdido' AND motivo_perda_nome IS NOT NULL
    GROUP BY motivo_perda_nome
    ORDER BY COUNT(*) DESC
  )
  
  -- Construir JSON final otimizado
  SELECT json_build_object(
    'metricas_gerais', (
      SELECT json_build_object(
        'total_leads', metrica_total_leads,
        'valor_total', metrica_valor_total,
        'leads_ganhos', metrica_leads_ganhos,
        'leads_perdidos', metrica_leads_perdidos,
        'leads_em_andamento', metrica_leads_em_andamento,
        'ticket_medio', CASE WHEN metrica_total_leads > 0 THEN metrica_valor_total / metrica_total_leads ELSE 0 END,
        'taxa_conversao', CASE WHEN metrica_total_leads > 0 THEN (metrica_leads_ganhos::numeric / metrica_total_leads) * 100 ELSE 0 END
      ) FROM metricas
    ),
    'leads_por_estagio', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'stage_nome', stage_nome,
          'stage_ordem', stage_ordem,
          'count', estagio_count,
          'valor_total', estagio_valor_total,
          'ganhos', estagio_ganhos,
          'perdas', estagio_perdas,
          'em_andamento', estagio_em_andamento,
          'percentual', CASE WHEN (SELECT metrica_total_leads FROM metricas) > 0 THEN (estagio_count::numeric / (SELECT metrica_total_leads FROM metricas)) * 100 ELSE 0 END,
          'percentual_valor', CASE WHEN (SELECT metrica_valor_total FROM metricas) > 0 THEN (estagio_valor_total::numeric / (SELECT metrica_valor_total FROM metricas)) * 100 ELSE 0 END
        ) ORDER BY stage_ordem
      ), '[]'::json) FROM estagio_stats
    ),
    'leads_por_status', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'status', status,
          'count', status_count,
          'valor_total', status_valor_total,
          'percentual', CASE WHEN (SELECT metrica_total_leads FROM metricas) > 0 THEN (status_count::numeric / (SELECT metrica_total_leads FROM metricas)) * 100 ELSE 0 END,
          'percentual_valor', CASE WHEN (SELECT metrica_valor_total FROM metricas) > 0 THEN (status_valor_total::numeric / (SELECT metrica_valor_total FROM metricas)) * 100 ELSE 0 END
        )
      ), '[]'::json) FROM status_stats
    ),
    'motivos_perda', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'motivo', motivo,
          'count', perda_count,
          'valor_total', perda_valor_total,
          'percentual', CASE WHEN (SELECT COUNT(*) FROM base_leads WHERE status = 'perdido') > 0 
                             THEN (perda_count::numeric / (SELECT COUNT(*) FROM base_leads WHERE status = 'perdido')) * 100 
                             ELSE 0 END
        ) ORDER BY perda_count DESC
      ), '[]'::json) FROM perda_stats
    )
  ) INTO result;

  RAISE LOG 'get_dashboard_negocios_aggregated CORRIGIDO - Consulta concluída com sucesso';
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'get_dashboard_negocios_aggregated CORRIGIDO - Erro: %', SQLERRM;
    RAISE;
END;
$function$;