-- Corrigir funções restantes com search_path mutable - apenas as sem dependências

-- Atualizar apenas as funções seguras (sem dependências de triggers)
DROP FUNCTION IF EXISTS public.test_dashboard_leads_count(uuid);
DROP FUNCTION IF EXISTS public.clean_message_duplicates(uuid);

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

-- Para funções com dependências, usar apenas CREATE OR REPLACE (sem DROP)
-- Função handle_updated_at (tem triggers dependentes)
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

-- Função handle_new_user (tem trigger em auth.users dependente)
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