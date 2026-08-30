-- Apenas criar a função de teste - removendo configuração que falhouteste
CREATE OR REPLACE FUNCTION public.test_count_real_leads(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Contar TODOS os leads sem junções para teste puro
  SELECT COUNT(*) INTO v_count
  FROM crm_leads 
  WHERE tenant_id = p_tenant_id;
  
  RAISE LOG 'test_count_real_leads - tenant: %, total_real: %', p_tenant_id, v_count;
  
  RETURN v_count;
END;
$function$;