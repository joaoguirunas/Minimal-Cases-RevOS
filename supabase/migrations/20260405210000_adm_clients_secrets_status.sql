-- ADM: Secrets status RPC
-- Returns boolean existence indicators for service_role_key, db_password, management_token
-- Uses SECURITY DEFINER to bypass any column-level privilege gaps that may cause the
-- encrypted blob columns to return NULL even for super_admin users.

CREATE OR REPLACE FUNCTION public.adm_clients_secrets_status()
RETURNS TABLE(
  id UUID,
  has_service_role_key BOOLEAN,
  has_db_password BOOLEAN,
  has_management_token BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    (service_role_key IS NOT NULL AND service_role_key <> '') AS has_service_role_key,
    (db_password IS NOT NULL AND db_password <> '')           AS has_db_password,
    (management_token IS NOT NULL AND management_token <> '')  AS has_management_token
  FROM adm_clients;
$$;

COMMENT ON FUNCTION public.adm_clients_secrets_status IS
  'Returns boolean presence of encrypted secrets for all adm_clients. SECURITY DEFINER bypasses column-level privilege gaps.';

-- Ensure authenticated role can call the function and access adm_clients
GRANT EXECUTE ON FUNCTION public.adm_clients_secrets_status TO authenticated;
GRANT ALL ON public.adm_clients TO authenticated;
