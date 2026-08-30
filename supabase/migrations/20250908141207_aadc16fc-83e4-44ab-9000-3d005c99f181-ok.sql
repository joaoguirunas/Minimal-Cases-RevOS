-- Corrigir a função RPC para aplicar corretamente os filtros de hierarquia
CREATE OR REPLACE FUNCTION public.get_dashboard_conversas_aggregated(
  p_tenant_id uuid, 
  p_data_inicio timestamp with time zone DEFAULT NULL, 
  p_data_fim timestamp with time zone DEFAULT NULL, 
  p_responsavel uuid DEFAULT NULL
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

  -- Query base com CTEs para otimização e filtros hierárquicos corretos
  WITH mensagens_filtradas AS (
    SELECT 
      m.from_message,
      m.tipo_mensagem,
      m.followup_id,
      m.pessoa_id,
      m.created_at,
      m.lead_id
    FROM crm_messages m
    LEFT JOIN crm_leads l ON l.id = m.lead_id AND l.tenant_id = p_tenant_id
    WHERE m.tenant_id = p_tenant_id
      AND (p_data_inicio IS NULL OR m.created_at >= p_data_inicio)
      AND (p_data_fim IS NULL OR m.created_at <= p_data_fim)
      -- FILTRO HIERÁRQUICO: Se p_responsavel especificado, filtrar por leads do responsável
      AND (p_responsavel IS NULL OR l.responsavel = p_responsavel)
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