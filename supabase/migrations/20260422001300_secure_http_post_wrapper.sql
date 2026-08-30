-- secure_http_post wrapper — ADR-SP-05
-- SECURITY DEFINER function that fetches secrets from Vault and logs access.
-- Replaces hardcoded JWTs in cron migrations with a single audited call site.
-- Depends on: public.secret_access_log (20260422001200), vault extension, pg_net extension.

BEGIN;

CREATE OR REPLACE FUNCTION public.secure_http_post(
  secret_name text,
  url text,
  body jsonb,
  caller_context text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret   text;
  v_response jsonb;
BEGIN
  -- Fetch secret from Vault (Vault bootstrap is a manual step — see ADR-SP-05)
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = secret_name;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', secret_name;
  END IF;

  -- Audit log (append-only via secret_access_log)
  INSERT INTO public.secret_access_log (secret_name, caller_context)
  VALUES (secret_name, caller_context);

  -- HTTP POST via pg_net
  SELECT net.http_post(
    url     := url,
    body    := body::text,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    )
  )::jsonb INTO v_response;

  RETURN v_response;
END;
$$;

-- Revoke public access; only service_role may call this function
REVOKE ALL ON FUNCTION public.secure_http_post(text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secure_http_post(text, text, jsonb, text) TO service_role;

COMMIT;
