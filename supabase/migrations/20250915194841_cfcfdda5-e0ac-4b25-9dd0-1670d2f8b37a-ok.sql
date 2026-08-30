-- VERIFICAÇÃO CORRETA do search_path nas funções
-- Usar pg_get_function_arguments para verificar configurações

-- Listar funções específicas que ainda aparecem nos alertas
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) LIKE '%SET search_path%' as has_search_path_set
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('clean_message_duplicates', 'get_dashboard_conversas_aggregated')
ORDER BY p.proname, pg_get_function_arguments(p.oid);