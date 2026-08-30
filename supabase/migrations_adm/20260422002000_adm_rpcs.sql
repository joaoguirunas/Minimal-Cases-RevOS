-- ADM-V3-07: Formalize encryption RPCs in migrations_adm/
-- Idempotent — safe to re-run on a fresh control plane
-- Source: supabase/migrations/20260325210000_adm_secrets_encryption.sql
--         supabase/migrations/20260405210000_adm_clients_secrets_status.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

-- ── Generic encrypt/decrypt helpers ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.app_encrypt_secret(p_value TEXT, p_context TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_value IS NULL OR p_value = '' THEN
    RETURN NULL;
  END IF;
  RETURN encode(pgp_sym_encrypt(p_value, concat('app_secret_', p_context)), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.app_decrypt_secret(p_encrypted TEXT, p_context TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64'), concat('app_secret_', p_context));
EXCEPTION WHEN OTHERS THEN
  -- Return raw value if decryption fails (backwards compat during migration)
  RETURN p_encrypted;
END;
$$;

-- ── Per-client decrypted secrets wrapper ─────────────────────────────────────
-- Used by edge functions: SELECT * FROM adm_client_decrypted_secrets('client-uuid')

CREATE OR REPLACE FUNCTION public.adm_client_decrypted_secrets(p_client_id UUID)
RETURNS TABLE (
  service_role_key TEXT,
  db_password TEXT,
  management_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_context TEXT;
BEGIN
  v_context := p_client_id::TEXT;
  RETURN QUERY
    SELECT
      app_decrypt_secret(c.service_role_key, v_context) AS service_role_key,
      app_decrypt_secret(c.db_password, v_context) AS db_password,
      app_decrypt_secret(c.management_token, v_context) AS management_token
    FROM adm_clients c
    WHERE c.id = p_client_id;
END;
$$;

-- ── Secrets presence status (booleans only — no decryption) ──────────────────
-- Called from AdmClientSingle UI to show which credentials are set

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
    (db_password      IS NOT NULL AND db_password      <> '') AS has_db_password,
    (management_token IS NOT NULL AND management_token <> '') AS has_management_token
  FROM adm_clients;
$$;

GRANT EXECUTE ON FUNCTION public.adm_clients_secrets_status TO authenticated;
