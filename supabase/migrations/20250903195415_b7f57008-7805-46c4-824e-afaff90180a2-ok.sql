-- Correção crítica de segurança: Fixar search_path das funções

-- 1. Criar schema para extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Mover extensão vector para schema dedicado
ALTER EXTENSION vector SET SCHEMA extensions;

-- 3. Corrigir funções com search_path mutable
-- Adicionar SET search_path TO 'public' para todas as funções críticas

-- Função migrate_campanhas_to_disparos
CREATE OR REPLACE FUNCTION public.migrate_campanhas_to_disparos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o JSON contém 'campanhas' mas não 'disparos', migrar
  IF NEW.modulos_ativos ? 'campanhas' AND NOT NEW.modulos_ativos ? 'disparos' THEN
    NEW.modulos_ativos = jsonb_set(
      NEW.modulos_ativos - 'campanhas',
      '{disparos}',
      NEW.modulos_ativos->'campanhas'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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

-- Função get_user_by_auth_id
CREATE OR REPLACE FUNCTION public.get_user_by_auth_id(auth_id uuid)
 RETURNS TABLE(id uuid, auth_user_id uuid, nome text, email text, whatsapp text, gestor boolean, ativo boolean, super_adm boolean, tenant_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, deleted_at timestamp with time zone, deleted_by uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.auth_user_id, u.nome, u.email, u.whatsapp, u.gestor, u.ativo, u.super_adm, u.tenant_id, u.created_at, u.updated_at, u.deleted_at, u.deleted_by
  FROM crm_usuarios u
  WHERE u.auth_user_id = get_user_by_auth_id.auth_id;
END;
$function$;

-- Função trigger_set_timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Função debug_auth_context
CREATE OR REPLACE FUNCTION public.debug_auth_context()
 RETURNS TABLE(current_user_id uuid, current_tenant_id uuid, session_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    (SELECT tenant_id FROM crm_usuarios WHERE auth_user_id = auth.uid() LIMIT 1) as current_tenant_id,
    (auth.uid() IS NOT NULL) as session_valid;
END;
$function$;

-- Função prevent_exact_message_duplicates
CREATE OR REPLACE FUNCTION public.prevent_exact_message_duplicates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if an exact duplicate exists (same lead, message, sender, within 2 seconds)
  IF EXISTS (
    SELECT 1 FROM public.crm_messages 
    WHERE lead_id = NEW.lead_id 
    AND message = NEW.message 
    AND from_message = NEW.from_message
    AND ABS(EXTRACT(EPOCH FROM (created_at - NEW.created_at))) < 2
    AND id != COALESCE(NEW.id, 0)
  ) THEN
    -- Log the attempted duplicate but don't fail - just skip it
    RAISE NOTICE 'Duplicate message detected and prevented: lead_id=%, message=%, from=%', 
      NEW.lead_id, LEFT(NEW.message, 50), NEW.from_message;
    RETURN NULL; -- This prevents the insert/update
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Função check_horario_disponivel
CREATE OR REPLACE FUNCTION public.check_horario_disponivel(p_horario timestamp without time zone, p_usuario_id uuid, p_tenant_id uuid)
 RETURNS TABLE(horario_preferencia text, hora_inicio time without time zone, hora_fim time without time zone, tem_conflito boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
RETURN QUERY
SELECT 
TO_CHAR (p_horario, 'YYYY-MM-DD HH24:MI') AS horario_preferencia,
a.hora_inicio,
a.hora_fim,
true as tem_conflito
FROM
crm_agendamentos a
WHERE
a.usuario_id = p_usuario_id
AND a.tenant_id = p_tenant_id
AND a.data = p_horario::date
AND (p_horario::time, (p_horario::time + interval '1 hour'))
OVERLAPS (a.hora_inicio, a.hora_fim);
-- disponível-- Se não encontrou conflitos, retorna que está disponível
IF NOT FOUND THEN
RETURN QUERY
SELECT
TO_CHAR (p_horario, 'YYYY-MM-DD HH24:MI'),
NULL::time,
NULL::time,
false as tem_conflito;
END IF;
END;
$function$;

-- Comentário sobre funções que não foram encontradas nos dados do contexto:
-- As seguintes funções mencionadas nos alertas não estão visíveis no contexto:
-- - test_dashboard_leads_count
-- - handle_updated_at  
-- - clean_message_duplicates
-- - handle_new_user
-- - get_dashboard_conversas_aggregated (já tem search_path definido)
-- - get_dashboard_campanhas_aggregated (já tem search_path definido)

-- Nota: Algumas funções já têm SET search_path TO 'public' definido corretamente