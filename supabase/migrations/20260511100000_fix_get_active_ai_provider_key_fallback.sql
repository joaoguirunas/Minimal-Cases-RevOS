-- Fix get_active_ai_provider_key: fallback to any active provider when no default is set.
-- Behavior: prefer is_default=true, otherwise return the oldest active key.
-- This prevents "gemini_not_configured" errors when the user saved a key without
-- toggling "Padrão para este provedor".

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
  -- Prefer the explicit default; fall back to any active provider for this type.
  SELECT api_key
    INTO v_key
    FROM public.settings_ai_providers
   WHERE provider = p_provider
     AND active   = true
   ORDER BY is_default DESC, created_at ASC
   LIMIT 1;

  RETURN v_key; -- NULL when not configured at all
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_ai_provider_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_ai_provider_key(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_active_ai_provider_key(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_active_ai_provider_key(text) TO service_role;

COMMENT ON FUNCTION public.get_active_ai_provider_key(text) IS
  'Returns api_key for the provider: prefers is_default=true, falls back to any active row. service_role only.';
