-- get_public_settings: returns only safe public fields from the singleton settings row.
-- Used by unauthenticated public pages (privacy policy, data deletion) to resolve
-- the tenant's company name and logo from their Supabase project without exposing
-- sensitive fields (apify_token, google_client_id, primary_color, credentials, etc.).
--
-- SECURITY DEFINER: runs as the function owner (postgres), bypassing RLS which
-- currently restricts SELECT on settings to authenticated role only.
--
-- Accessible by role anon — no auth required.

CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
  company_name text,
  logo_url     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_name, logo_url
  FROM   public.settings
  LIMIT  1;
$$;

-- Revoke from PUBLIC first (PostgreSQL grants EXECUTE to PUBLIC by default)
REVOKE EXECUTE ON FUNCTION public.get_public_settings() FROM PUBLIC;

-- Grant only to anon (unauthenticated callers) and authenticated (existing users)
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO authenticated;
