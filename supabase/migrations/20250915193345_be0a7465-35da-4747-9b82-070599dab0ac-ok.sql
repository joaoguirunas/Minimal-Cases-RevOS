-- Fix remaining functions with missing search_path
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

CREATE OR REPLACE FUNCTION public.encrypt_api_key(key_value text, secret_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Simple base64 encoding for now (not secure but better than plaintext)
  RETURN encode(key_value::bytea, 'base64');
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text, secret_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN decode(encrypted_key, 'base64')::text;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

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