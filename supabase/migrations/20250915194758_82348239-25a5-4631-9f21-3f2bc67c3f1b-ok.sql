-- CORREÇÃO DEFINITIVA: Remover versões duplicadas da função get_dashboard_conversas_aggregated
-- O problema é que existe uma versão duplicada sem todos os parâmetros

-- Dropar a versão problemática
DROP FUNCTION IF EXISTS public.get_dashboard_conversas_aggregated(
  p_tenant_id uuid,
  p_data_inicio timestamp with time zone,
  p_data_fim timestamp with time zone,
  p_responsavel uuid
);

-- Verificar se a consulta de listagem funcionou corretamente
-- O problema pode ser que existem múltiplas assinaturas da mesma função

-- Verificar todas as versões de clean_message_duplicates e get_dashboard_conversas_aggregated
DO $cleanup_functions$
BEGIN
  -- Verificar e limpar clean_message_duplicates
  PERFORM 1 FROM pg_proc p 
  JOIN pg_namespace n ON p.pronamespace = n.oid 
  WHERE n.nspname = 'public' 
  AND p.proname = 'clean_message_duplicates';
  
  IF FOUND THEN
    -- Dropar função sem parâmetros se existir
    DROP FUNCTION IF EXISTS public.clean_message_duplicates();
  END IF;
  
  -- Verificar get_dashboard_conversas_aggregated
  PERFORM 1 FROM pg_proc p 
  JOIN pg_namespace n ON p.pronamespace = n.oid 
  WHERE n.nspname = 'public' 
  AND p.proname = 'get_dashboard_conversas_aggregated';
  
  IF FOUND THEN
    -- Manter apenas a versão com 5 parâmetros
    -- Dropar versão com 4 parâmetros se existir
    DROP FUNCTION IF EXISTS public.get_dashboard_conversas_aggregated(
      uuid, timestamp with time zone, timestamp with time zone, uuid
    );
  END IF;
END;
$cleanup_functions$;

-- Agora verificar quantas funções ainda precisam de search_path
SELECT COUNT(*) as functions_without_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.prokind = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc_config pc
    WHERE pc.proconfig_id = p.oid
    AND pc.proconfig @> ARRAY['search_path=public']
  );