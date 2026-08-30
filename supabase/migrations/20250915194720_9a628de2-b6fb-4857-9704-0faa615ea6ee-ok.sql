-- Investigação e correção final dos alertas de search_path
-- Verificar e corrigir definitivamente as funções que ainda aparecem com problemas

-- 1. Verificar se existe uma versão duplicada sem parâmetros da clean_message_duplicates
DO $check_clean_function$
BEGIN
  -- Dropar todas as versões da função clean_message_duplicates
  DROP FUNCTION IF EXISTS public.clean_message_duplicates();
  DROP FUNCTION IF EXISTS public.clean_message_duplicates(uuid);
  DROP FUNCTION IF EXISTS public.clean_message_duplicates(p_tenant_id uuid);
  
  -- Recriar apenas a versão correta com search_path
  CREATE OR REPLACE FUNCTION public.clean_message_duplicates(p_tenant_id uuid)
   RETURNS integer
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path TO 'public'
  AS $inner_function$
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
  $inner_function$;
END;
$check_clean_function$;

-- 2. Verificar e corrigir get_dashboard_conversas_aggregated
DO $check_conversas_function$
BEGIN
  -- Dropar todas as versões da função get_dashboard_conversas_aggregated
  DROP FUNCTION IF EXISTS public.get_dashboard_conversas_aggregated();
  DROP FUNCTION IF EXISTS public.get_dashboard_conversas_aggregated(uuid);
  DROP FUNCTION IF EXISTS public.get_dashboard_conversas_aggregated(
    uuid, timestamp with time zone, timestamp with time zone, uuid, integer[]
  );
  
  -- Recriar a versão correta com search_path
  CREATE OR REPLACE FUNCTION public.get_dashboard_conversas_aggregated(
    p_tenant_id uuid,
    p_data_inicio timestamp with time zone DEFAULT NULL,
    p_data_fim timestamp with time zone DEFAULT NULL,
    p_responsavel uuid DEFAULT NULL,
    p_scores integer[] DEFAULT NULL
  )
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $inner_function$
  DECLARE
    v_result JSON;
  BEGIN
    -- Validação básica
    IF p_tenant_id IS NULL THEN
      RAISE EXCEPTION 'tenant_id é obrigatório';
    END IF;

    -- Query principal simplificada para conversas
    WITH conversas_base AS (
      SELECT 
        cm.lead_id,
        cm.created_at,
        cp.score,
        COUNT(cm.id) as total_mensagens,
        cl.responsavel
      FROM crm_messages cm
      INNER JOIN crm_leads cl ON cm.lead_id = cl.id
      INNER JOIN crm_pessoas cp ON cl.person_id = cp.id
      WHERE cm.tenant_id = p_tenant_id
        AND (p_data_inicio IS NULL OR cm.created_at >= p_data_inicio)
        AND (p_data_fim IS NULL OR cm.created_at <= p_data_fim)
        AND (p_responsavel IS NULL OR cl.responsavel = p_responsavel)
        AND (
          p_scores IS NULL 
          OR array_length(p_scores, 1) IS NULL 
          OR (
            (0 = ANY(p_scores) AND cp.score IS NULL) 
            OR cp.score = ANY(p_scores)
          )
        )
      GROUP BY cm.lead_id, cm.created_at, cp.score, cl.responsavel
    ),
    
    metricas_resumo AS (
      SELECT 
        COUNT(DISTINCT lead_id) as total_conversas,
        SUM(total_mensagens) as total_mensagens,
        COUNT(DISTINCT responsavel) as total_responsaveis
      FROM conversas_base
    ),
    
    evolucao_diaria AS (
      SELECT 
        DATE(created_at) as data,
        COUNT(DISTINCT lead_id) as conversas_dia,
        SUM(total_mensagens) as mensagens_dia
      FROM conversas_base
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    )
    
    SELECT json_build_object(
      'totalConversas', (SELECT total_conversas FROM metricas_resumo),
      'totalMensagens', (SELECT total_mensagens FROM metricas_resumo),
      'totalResponsaveis', (SELECT total_responsaveis FROM metricas_resumo),
      'evolucaoDiaria', (
        SELECT COALESCE(json_agg(
          json_build_object(
            'data', data,
            'conversas', conversas_dia,
            'mensagens', mensagens_dia
          ) ORDER BY data
        ), '[]'::json)
        FROM evolucao_diaria
      )
    ) INTO v_result;

    RETURN v_result;
  END;
  $inner_function$;
END;
$check_conversas_function$;

-- 3. Verificar se há outras funções órfãs sem search_path
-- Listar todas as funções que não têm search_path configurado
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE WHEN 'search_path' = ANY(string_to_array(pg_get_function_identity_arguments(p.oid), ',')) 
    THEN 'HAS_SEARCH_PATH' 
    ELSE 'MISSING_SEARCH_PATH' 
  END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.prokind = 'f'
ORDER BY p.proname;