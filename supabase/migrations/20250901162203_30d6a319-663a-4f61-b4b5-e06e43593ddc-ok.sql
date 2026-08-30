-- Corrigir a função RPC get_dashboard_negocios_aggregated que está com erro SQL
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
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Log de início
  RAISE LOG 'get_dashboard_negocios_aggregated - tenant_id: %, SEM LIMITAÇÕES', p_tenant_id;

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
  )
  
  -- Construir resultado COMPLETO
  SELECT json_build_object(
    'totalLeads', (SELECT COUNT(*) FROM leads_completos),
    'leadsGanhos', (SELECT COUNT(*) FROM leads_completos WHERE status = 'ganho'),
    'leadsPerdidos', (SELECT COUNT(*) FROM leads_completos WHERE status = 'perdido'),
    'leadsEmAndamento', (SELECT COUNT(*) FROM leads_completos WHERE status = 'em-andamento'),
    'valorTotal', (SELECT COALESCE(SUM(valor), 0) FROM leads_completos),
    'valorGanho', (SELECT COALESCE(SUM(CASE WHEN status = 'ganho' THEN valor ELSE 0 END), 0) FROM leads_completos),
    'ticketMedio', (
      SELECT CASE WHEN COUNT(*) > 0 
        THEN COALESCE(SUM(valor), 0) / COUNT(*)::numeric 
        ELSE 0 END 
      FROM leads_completos
    ),
    'taxaConversao', (
      SELECT CASE WHEN COUNT(*) > 0 
        THEN (COUNT(*) FILTER (WHERE status = 'ganho')::numeric / COUNT(*)::numeric) * 100 
        ELSE 0 END 
      FROM leads_completos
    ),
    'leadsPorEstagio', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'nome', stage_nome,
          'pipeline', pipeline_nome,
          'ordem', stage_ordem,
          'count', total,
          'valorTotal', valor_total,
          'percentual', percentual,
          'percentualValor', percentual_valor,
          'ganhos', ganhos,
          'perdas', perdas,
          'emAndamento', em_andamento
        ) ORDER BY stage_ordem
      ), '[]'::json)
      FROM (
        SELECT 
          stage_nome,
          pipeline_nome,
          stage_ordem,
          COUNT(*) as total,
          COALESCE(SUM(valor), 0) as valor_total,
          COUNT(*)::numeric / (SELECT COUNT(*) FROM leads_completos)::numeric * 100 as percentual,
          COALESCE(SUM(valor), 0) / NULLIF((SELECT COALESCE(SUM(valor), 0) FROM leads_completos), 0) * 100 as percentual_valor,
          COUNT(*) FILTER (WHERE status = 'ganho') as ganhos,
          COUNT(*) FILTER (WHERE status = 'perdido') as perdas,
          COUNT(*) FILTER (WHERE status = 'em-andamento') as em_andamento
        FROM leads_completos
        WHERE stage_nome IS NOT NULL
        GROUP BY stage_nome, pipeline_nome, stage_ordem
      ) grouped_stages
    ),
    'leadsPorStatus', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'status', status,
          'count', total,
          'valorTotal', valor_total,
          'percentual', percentual,
          'percentualValor', percentual_valor
        )
      ), '[]'::json)
      FROM (
        SELECT 
          status,
          COUNT(*) as total,
          COALESCE(SUM(valor), 0) as valor_total,
          COUNT(*)::numeric / (SELECT COUNT(*) FROM leads_completos)::numeric * 100 as percentual,
          COALESCE(SUM(valor), 0) / NULLIF((SELECT COALESCE(SUM(valor), 0) FROM leads_completos), 0) * 100 as percentual_valor
        FROM leads_completos
        GROUP BY status
      ) grouped_status
    ),
    'motivosPerda', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'motivo', motivo_perda_nome,
          'count', total,
          'valorTotal', valor_total,
          'percentual', percentual
        ) ORDER BY total DESC
      ), '[]'::json)
      FROM (
        SELECT 
          motivo_perda_nome,
          COUNT(*) as total,
          COALESCE(SUM(valor), 0) as valor_total,
          COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM leads_completos WHERE status = 'perdido')::numeric, 0) * 100 as percentual
        FROM leads_completos
        WHERE status = 'perdido' AND motivo_perda_nome IS NOT NULL
        GROUP BY motivo_perda_nome
      ) grouped_motivos
    )
  ) INTO v_result;

  RAISE LOG 'get_dashboard_negocios_aggregated - Consulta concluída - Total processado: %', (SELECT COUNT(*) FROM leads_completos);
  RETURN v_result;
END;
$function$;