-- REMOVER A VERSÃO PROBLEMÁTICA da função get_dashboard_conversas_aggregated
-- Existem 2 versões: uma com 4 parâmetros (sem search_path) e outra com 5 parâmetros (com search_path)

-- Dropar especificamente a versão com 4 parâmetros que não tem search_path
DROP FUNCTION public.get_dashboard_conversas_aggregated(
  p_tenant_id uuid, 
  p_data_inicio timestamp with time zone, 
  p_data_fim timestamp with time zone, 
  p_responsavel uuid
);

-- Verificar se ficou apenas a versão correta
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) LIKE '%SET search_path%' as has_search_path_set
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_dashboard_conversas_aggregated';