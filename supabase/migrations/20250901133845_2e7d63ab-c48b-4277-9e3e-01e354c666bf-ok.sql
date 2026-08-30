-- Otimizar a função get_dashboard_negocios_aggregated para evitar timeouts

-- Primeiro, vamos criar índices para melhorar a performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_created_at ON crm_leads(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_status ON crm_leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_pipeline ON crm_leads(tenant_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_stage ON crm_leads(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_responsavel ON crm_leads(tenant_id, responsavel);
CREATE INDEX IF NOT EXISTS idx_crm_pessoas_score ON crm_pessoas(score);

-- Otimizar a função principal
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
  total_leads INTEGER;
  leads_ganhos INTEGER;
  leads_perdidos INTEGER;
  leads_em_andamento INTEGER;
  valor_total NUMERIC;
BEGIN
  -- Log otimizado
  RAISE LOG 'get_dashboard_negocios_aggregated OTIMIZADO - tenant_id: %, filters aplicados', p_tenant_id;

  -- Query otimizada usando agregações diretas
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
      COUNT(*) as total_leads,
      COALESCE(SUM(valor), 0) as valor_total,
      COUNT(*) FILTER (WHERE status = 'ganho') as leads_ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as leads_perdidos,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as leads_em_andamento
    FROM base_leads
  ),
  
  -- Leads por estágio otimizado
  estagio_stats AS (
    SELECT 
      stage_nome,
      stage_ordem,
      COUNT(*) as count,
      COALESCE(SUM(valor), 0) as valor_total,
      COUNT(*) FILTER (WHERE status = 'ganho') as ganhos,
      COUNT(*) FILTER (WHERE status = 'perdido') as perdas,
      COUNT(*) FILTER (WHERE status = 'em-andamento') as em_andamento
    FROM base_leads
    GROUP BY stage_nome, stage_ordem
    ORDER BY stage_ordem
  ),
  
  -- Leads por status otimizado
  status_stats AS (
    SELECT 
      status,
      COUNT(*) as count,
      COALESCE(SUM(valor), 0) as valor_total
    FROM base_leads
    GROUP BY status
  ),
  
  -- Motivos de perda otimizado
  perda_stats AS (
    SELECT 
      motivo_perda_nome as motivo,
      COUNT(*) as count,
      COALESCE(SUM(valor), 0) as valor_total
    FROM base_leads
    WHERE status = 'perdido' AND motivo_perda_nome IS NOT NULL
    GROUP BY motivo_perda_nome
    ORDER BY count DESC
    LIMIT 10 -- Limitar para evitar dados excessivos
  )
  
  -- Construir JSON final otimizado
  SELECT json_build_object(
    'metricas_gerais', (
      SELECT json_build_object(
        'total_leads', total_leads,
        'valor_total', valor_total,
        'leads_ganhos', leads_ganhos,
        'leads_perdidos', leads_perdidos,
        'leads_em_andamento', leads_em_andamento,
        'ticket_medio', CASE WHEN total_leads > 0 THEN valor_total / total_leads ELSE 0 END,
        'taxa_conversao', CASE WHEN total_leads > 0 THEN (leads_ganhos::numeric / total_leads) * 100 ELSE 0 END
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
          'em_andamento', em_andamento,
          'percentual', CASE WHEN (SELECT total_leads FROM metricas) > 0 THEN (count::numeric / (SELECT total_leads FROM metricas)) * 100 ELSE 0 END,
          'percentual_valor', CASE WHEN (SELECT valor_total FROM metricas) > 0 THEN (valor_total::numeric / (SELECT valor_total FROM metricas)) * 100 ELSE 0 END
        ) ORDER BY stage_ordem
      ), '[]'::json) FROM estagio_stats
    ),
    'leads_por_status', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'status', status,
          'count', count,
          'valor_total', valor_total,
          'percentual', CASE WHEN (SELECT total_leads FROM metricas) > 0 THEN (count::numeric / (SELECT total_leads FROM metricas)) * 100 ELSE 0 END,
          'percentual_valor', CASE WHEN (SELECT valor_total FROM metricas) > 0 THEN (valor_total::numeric / (SELECT valor_total FROM metricas)) * 100 ELSE 0 END
        )
      ), '[]'::json) FROM status_stats
    ),
    'motivos_perda', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'motivo', motivo,
          'count', count,
          'valor_total', valor_total,
          'percentual', CASE WHEN (SELECT COUNT(*) FROM base_leads WHERE status = 'perdido') > 0 
                             THEN (count::numeric / (SELECT COUNT(*) FROM base_leads WHERE status = 'perdido')) * 100 
                             ELSE 0 END
        ) ORDER BY count DESC
      ), '[]'::json) FROM perda_stats
    )
  ) INTO result;

  RAISE LOG 'get_dashboard_negocios_aggregated OTIMIZADO - Consulta concluída com sucesso';
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'get_dashboard_negocios_aggregated OTIMIZADO - Erro: %', SQLERRM;
    RAISE;
END;
$function$;