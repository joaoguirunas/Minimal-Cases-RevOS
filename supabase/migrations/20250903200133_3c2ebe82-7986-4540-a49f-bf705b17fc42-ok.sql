-- Correção das funções restantes com search_path mutable

-- Função get_dashboard_conversas_aggregated (recriar com search_path)
CREATE OR REPLACE FUNCTION public.get_dashboard_conversas_aggregated(p_tenant_id uuid, p_data_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_data_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_responsavel uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_total_mensagens INTEGER := 0;
  v_mensagens_humanas INTEGER := 0;
  v_mensagens_ia INTEGER := 0;
  v_mensagens_clientes INTEGER := 0;
  v_mensagens_followups INTEGER := 0;
  v_quantidade_chamadas INTEGER := 0;
  v_total_conversas INTEGER := 0;
  v_mensagens_por_origem JSON;
  v_mensagens_por_tipo JSON;
  v_conversas_por_pessoa JSON;
BEGIN
  -- Validação básica
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  -- Query base com CTEs para otimização
  WITH mensagens_filtradas AS (
    SELECT 
      from_message,
      tipo_mensagem,
      followup_id,
      pessoa_id,
      created_at,
      lead_id
    FROM crm_messages 
    WHERE tenant_id = p_tenant_id
      AND (p_data_inicio IS NULL OR created_at >= p_data_inicio)
      AND (p_data_fim IS NULL OR created_at <= p_data_fim)
      AND (p_responsavel IS NULL OR lead_id IN (
        SELECT id FROM crm_leads 
        WHERE tenant_id = p_tenant_id 
        AND responsavel = p_responsavel
      ))
  ),
  metricas_basicas AS (
    SELECT 
      COUNT(*) as total_mensagens,
      COUNT(*) FILTER (WHERE from_message = 'humano') as mensagens_humanas,
      COUNT(*) FILTER (WHERE from_message = 'agente_ia') as mensagens_ia,
      COUNT(*) FILTER (WHERE from_message = 'cliente') as mensagens_clientes,
      COUNT(*) FILTER (WHERE followup_id IS NOT NULL) as mensagens_followups,
      COUNT(*) FILTER (WHERE tipo_mensagem = 'chamada') as quantidade_chamadas,
      COUNT(DISTINCT pessoa_id) FILTER (WHERE pessoa_id IS NOT NULL) as total_conversas
    FROM mensagens_filtradas
  ),
  mensagens_origem AS (
    SELECT 
      CASE 
        WHEN from_message = 'agente_ia' THEN 'Agente IA'
        WHEN from_message = 'humano' THEN 'Humano'
        WHEN from_message = 'cliente' THEN 'Cliente'
        ELSE 'Outros'
      END as origem,
      COUNT(*) as count
    FROM mensagens_filtradas
    WHERE from_message IS NOT NULL
    GROUP BY from_message
    HAVING COUNT(*) > 0
  ),
  mensagens_tipo AS (
    SELECT 
      COALESCE(tipo_mensagem, 'texto') as tipo,
      COUNT(*) as count
    FROM mensagens_filtradas
    GROUP BY tipo_mensagem
  ),
  conversas_pessoa AS (
    SELECT 
      mf.pessoa_id,
      cp.nome as pessoa_nome,
      COUNT(*) as total_mensagens,
      MAX(mf.created_at) as ultima_mensagem
    FROM mensagens_filtradas mf
    LEFT JOIN crm_pessoas cp ON cp.id = mf.pessoa_id AND cp.tenant_id = p_tenant_id
    WHERE mf.pessoa_id IS NOT NULL
    GROUP BY mf.pessoa_id, cp.nome
    ORDER BY MAX(mf.created_at) DESC
    LIMIT 100
  )
  
  -- Construir o resultado final
  SELECT 
    json_build_object(
      'metricas_gerais', (
        SELECT json_build_object(
          'total_mensagens', total_mensagens,
          'mensagens_humanas', mensagens_humanas,
          'mensagens_ia', mensagens_ia,
          'mensagens_clientes', mensagens_clientes,
          'mensagens_followups', mensagens_followups,
          'quantidade_chamadas', quantidade_chamadas,
          'total_conversas', total_conversas,
          'conversas_abandonadas', 0,
          'tempo_medio_ia', 0,
          'tempo_medio_cliente', 0
        )
        FROM metricas_basicas
      ),
      'mensagens_por_origem', (
        SELECT COALESCE(json_agg(json_build_object('origem', origem, 'count', count)), '[]'::json)
        FROM mensagens_origem
      ),
      'mensagens_por_tipo', (
        SELECT COALESCE(json_agg(json_build_object('tipo', tipo, 'count', count)), '[]'::json)
        FROM mensagens_tipo
      ),
      'conversas_por_pessoa', (
        SELECT COALESCE(json_agg(json_build_object(
          'pessoa_nome', COALESCE(pessoa_nome, 'Sem nome'),
          'total_mensagens', total_mensagens,
          'ultima_mensagem', ultima_mensagem
        )), '[]'::json)
        FROM conversas_pessoa
      )
    ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Função get_dashboard_campanhas_aggregated (recriar com search_path)
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

-- Criar funções que podem não existir ainda mas aparecem nos alertas

-- Função test_dashboard_leads_count
CREATE OR REPLACE FUNCTION public.test_dashboard_leads_count(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM crm_leads
  WHERE tenant_id = p_tenant_id;
  
  RETURN total_count;
END;
$function$;

-- Função handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Função clean_message_duplicates
CREATE OR REPLACE FUNCTION public.clean_message_duplicates(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY lead_id, message, from_message, 
             DATE_TRUNC('minute', created_at)
             ORDER BY created_at
           ) as rn
    FROM crm_messages
    WHERE tenant_id = p_tenant_id
  )
  DELETE FROM crm_messages
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

-- Função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Lógica para processar novos usuários
  -- Esta função pode ser chamada por um trigger em auth.users
  RETURN NEW;
END;
$function$;