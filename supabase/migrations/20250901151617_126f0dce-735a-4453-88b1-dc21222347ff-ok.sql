-- Criar função RPC para dashboard de campanhas sem limitações
CREATE OR REPLACE FUNCTION public.get_dashboard_campanhas_aggregated(
  p_tenant_id uuid,
  p_data_inicio timestamp with time zone DEFAULT NULL,
  p_data_fim timestamp with time zone DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_scores integer[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Validação básica
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  -- Query principal com agregação de dados de campanha
  WITH leads_filtrados AS (
    SELECT 
      cl.id,
      cl.utm_campaign,
      cl.utm_source,
      cl.utm_medium,
      cl.utm_term,
      cl.utm_content,
      cl.created_at,
      cp.score,
      -- Subquery para agendamentos
      (
        SELECT json_agg(
          json_build_object(
            'id', ca.id,
            'status', ca.status,
            'data', ca.data,
            'criado_em', ca.criado_em
          )
        )
        FROM crm_agendamentos ca 
        WHERE ca.negocio_id = cl.id 
        AND ca.tenant_id = p_tenant_id
      ) as agendamentos_json
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
  
  campanhas_agregadas AS (
    SELECT 
      COALESCE(utm_campaign, 'Sem campanha') as utm_campaign,
      COALESCE(utm_source, 'Sem origem') as utm_source,
      COALESCE(utm_medium, 'Sem mídia') as utm_medium,
      COALESCE(utm_term, 'Sem termo') as utm_term,
      COALESCE(utm_content, 'Sem conteúdo') as utm_content,
      COUNT(*) as total_leads,
      COALESCE(SUM(
        CASE 
          WHEN agendamentos_json IS NOT NULL 
          THEN json_array_length(agendamentos_json) 
          ELSE 0 
        END
      ), 0) as total_agendamentos,
      COALESCE(SUM(
        CASE 
          WHEN agendamentos_json IS NOT NULL 
          THEN (
            SELECT COUNT(*) 
            FROM json_array_elements(agendamentos_json) as ag 
            WHERE ag->>'status' = 'compareceu'
          )
          ELSE 0 
        END
      ), 0) as compareceu,
      COALESCE(SUM(
        CASE 
          WHEN agendamentos_json IS NOT NULL 
          THEN (
            SELECT COUNT(*) 
            FROM json_array_elements(agendamentos_json) as ag 
            WHERE ag->>'status' = 'nao_compareceu'
          )
          ELSE 0 
        END
      ), 0) as nao_compareceu,
      COALESCE(SUM(
        CASE 
          WHEN agendamentos_json IS NOT NULL 
          THEN (
            SELECT COUNT(*) 
            FROM json_array_elements(agendamentos_json) as ag 
            WHERE ag->>'status' = 'cancelado'
          )
          ELSE 0 
        END
      ), 0) as cancelado
    FROM leads_filtrados
    GROUP BY utm_campaign, utm_source, utm_medium, utm_term, utm_content
  ),
  
  chart_data AS (
    SELECT 
      'utm_campaign' as tipo,
      json_agg(
        json_build_object(
          'periodo', COALESCE(utm_campaign, 'Não informado'),
          'leads', COUNT(*),
          'agendamentos', COALESCE(SUM(
            CASE 
              WHEN agendamentos_json IS NOT NULL 
              THEN json_array_length(agendamentos_json) 
              ELSE 0 
            END
          ), 0)
        )
      ) as dados
    FROM leads_filtrados
    GROUP BY utm_campaign
    
    UNION ALL
    
    SELECT 
      'utm_source' as tipo,
      json_agg(
        json_build_object(
          'periodo', COALESCE(utm_source, 'Não informado'),
          'leads', COUNT(*),
          'agendamentos', COALESCE(SUM(
            CASE 
              WHEN agendamentos_json IS NOT NULL 
              THEN json_array_length(agendamentos_json) 
              ELSE 0 
            END
          ), 0)
        )
      ) as dados
    FROM leads_filtrados
    GROUP BY utm_source
    
    UNION ALL
    
    SELECT 
      'utm_medium' as tipo,
      json_agg(
        json_build_object(
          'periodo', COALESCE(utm_medium, 'Não informado'),
          'leads', COUNT(*),
          'agendamentos', COALESCE(SUM(
            CASE 
              WHEN agendamentos_json IS NOT NULL 
              THEN json_array_length(agendamentos_json) 
              ELSE 0 
            END
          ), 0)
        )
      ) as dados
    FROM leads_filtrados
    GROUP BY utm_medium
    
    UNION ALL
    
    SELECT 
      'utm_term' as tipo,
      json_agg(
        json_build_object(
          'periodo', COALESCE(utm_term, 'Não informado'),
          'leads', COUNT(*),
          'agendamentos', COALESCE(SUM(
            CASE 
              WHEN agendamentos_json IS NOT NULL 
              THEN json_array_length(agendamentos_json) 
              ELSE 0 
            END
          ), 0)
        )
      ) as dados
    FROM leads_filtrados
    GROUP BY utm_term
    
    UNION ALL
    
    SELECT 
      'utm_content' as tipo,
      json_agg(
        json_build_object(
          'periodo', COALESCE(utm_content, 'Não informado'),
          'leads', COUNT(*),
          'agendamentos', COALESCE(SUM(
            CASE 
              WHEN agendamentos_json IS NOT NULL 
              THEN json_array_length(agendamentos_json) 
              ELSE 0 
            END
          ), 0)
        )
      ) as dados
    FROM leads_filtrados
    GROUP BY utm_content
  ),
  
  totais_gerais AS (
    SELECT 
      COUNT(*) as total_leads,
      COALESCE(SUM(
        CASE 
          WHEN agendamentos_json IS NOT NULL 
          THEN json_array_length(agendamentos_json) 
          ELSE 0 
        END
      ), 0) as total_agendamentos,
      COALESCE(SUM(
        CASE 
          WHEN agendamentos_json IS NOT NULL 
          THEN (
            SELECT COUNT(*) 
            FROM json_array_elements(agendamentos_json) as ag 
            WHERE ag->>'status' = 'compareceu'
          )
          ELSE 0 
        END
      ), 0) as total_compareceu,
      COALESCE(SUM(
        CASE 
          WHEN agendamentos_json IS NOT NULL 
          THEN (
            SELECT COUNT(*) 
            FROM json_array_elements(agendamentos_json) as ag 
            WHERE ag->>'status' IN ('compareceu', 'nao_compareceu', 'cancelado')
          )
          ELSE 0 
        END
      ), 0) as total_interacoes
    FROM leads_filtrados
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
    'campanhasChart', (
      SELECT json_object_agg(tipo, dados)
      FROM chart_data
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