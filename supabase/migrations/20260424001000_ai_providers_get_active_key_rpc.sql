-- BI-VOICE-00: RPC get_active_ai_provider_key
-- Returns the api_key for the active default provider of the given type.
-- SECURITY DEFINER + explicit REVOKE/GRANT restricts this to service_role only —
-- the api_key value never travels through RLS or client queries.

CREATE OR REPLACE FUNCTION public.get_active_ai_provider_key(
  p_provider text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT api_key
    INTO v_key
    FROM public.settings_ai_providers
   WHERE provider   = p_provider
     AND is_default = true
     AND active     = true
   LIMIT 1;

  RETURN v_key; -- NULL when not configured
END;
$$;

-- Strip all default grants, then allow only service_role
REVOKE ALL ON FUNCTION public.get_active_ai_provider_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_ai_provider_key(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_active_ai_provider_key(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_active_ai_provider_key(text) TO service_role;

COMMENT ON FUNCTION public.get_active_ai_provider_key(text) IS
  'BI-VOICE-00: Returns api_key for the active default provider. service_role only — never called from client.';
