-- Criar função de teste para verificar se há limitações PostgREST
CREATE OR REPLACE FUNCTION public.test_dashboard_leads_count(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_total_count INTEGER;
  v_sample_leads json;
BEGIN
  -- Contar TODOS os leads do tenant
  SELECT COUNT(*) INTO v_total_count
  FROM crm_leads 
  WHERE tenant_id = p_tenant_id;
  
  -- Buscar uma amostra dos primeiros 10 leads
  SELECT json_agg(
    json_build_object(
      'id', id,
      'valor', valor,
      'status', status,
      'created_at', created_at
    )
  ) INTO v_sample_leads
  FROM (
    SELECT id, valor, status, created_at
    FROM crm_leads 
    WHERE tenant_id = p_tenant_id 
    ORDER BY created_at DESC 
    LIMIT 10
  ) sample;
  
  RETURN json_build_object(
    'total_real_leads', v_total_count,
    'sample_leads', v_sample_leads,
    'message', 'Contagem real de leads no banco'
  );
END;
$function$;