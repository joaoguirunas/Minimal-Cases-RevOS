-- CORREÇÃO FINAL DOS ALERTAS DE SEGURANÇA
-- Corrigir as funções restantes que não têm search_path configurado

-- 1. Corrigir clean_message_duplicates function
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

-- 2. Corrigir is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM crm_usuarios 
    WHERE auth_user_id = auth.uid() 
    AND super_adm = true 
    AND ativo = true
  );
END;
$function$;

-- 3. Verificar se get_dashboard_conversas_aggregated existe e corrigir
DO $check_function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'get_dashboard_conversas_aggregated'
  ) THEN
    -- Se existe, corrigir o search_path
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
          COUNT(cm.id) as total_mensagens
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
        GROUP BY cm.lead_id, cm.created_at, cp.score
      ),
      
      metricas_resumo AS (
        SELECT 
          COUNT(DISTINCT lead_id) as total_conversas,
          SUM(total_mensagens) as total_mensagens
        FROM conversas_base
      )
      
      SELECT json_build_object(
        'totalConversas', (SELECT total_conversas FROM metricas_resumo),
        'totalMensagens', (SELECT total_mensagens FROM metricas_resumo)
      ) INTO v_result;

      RETURN v_result;
    END;
    $inner_function$;
  END IF;
END;
$check_function$;