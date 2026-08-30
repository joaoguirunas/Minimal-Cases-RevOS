-- ADM-V2-03: Secrets Encryption via pgcrypto
-- Encrypts service_role_key, db_password, management_token in adm_clients
-- Uses pgp_sym_encrypt/decrypt with client_id as salt (same pattern as crm_llm_connections)
-- Generic helpers: app_encrypt_secret / app_decrypt_secret (reusable by CONFIG-V2-01)

-- Ensure pgcrypto is available in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

-- ── 1. Add management_token column (missing from original schema) ───────────
ALTER TABLE public.adm_clients
  ADD COLUMN IF NOT EXISTS management_token TEXT DEFAULT NULL;

COMMENT ON COLUMN public.adm_clients.management_token IS 'Supabase Management API token. Encrypted via pgcrypto.';

-- ── 2. Generic encrypt/decrypt helper functions ─────────────────────────────
-- Salt pattern: concat(domain, '_', context_id) — same as encrypt_llm_api_key
-- SECURITY DEFINER: runs with function owner privileges (bypasses RLS for decrypt)

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
  -- If decryption fails (e.g., value was never encrypted / key mismatch),
  -- return the raw value as-is for backwards compatibility during migration
  RETURN p_encrypted;
END;
$$;

COMMENT ON FUNCTION public.app_encrypt_secret IS 'Encrypt a secret value using pgp_sym_encrypt. Context is used as salt. Reusable by any module.';
COMMENT ON FUNCTION public.app_decrypt_secret IS 'Decrypt a secret value using pgp_sym_decrypt. Returns raw value if decryption fails (backwards compat).';

-- ── 3. Convenience wrapper: decrypt secrets for a specific adm_client ───────
-- Used by edge functions via RPC: SELECT * FROM adm_client_decrypted_secrets('client-uuid')

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

COMMENT ON FUNCTION public.adm_client_decrypted_secrets IS 'Decrypt all secrets for a given adm_client. Used by edge functions via RPC.';

-- ── 4. Migrate existing plaintext secrets to encrypted values ───────────────
-- Idempotent: app_decrypt_secret returns raw value if already unencrypted,
-- so re-encrypting an already-encrypted value would double-encrypt.
-- We detect plaintext by checking if value starts with 'eyJ' (JWT) or doesn't start with encrypted base64 pattern.

DO $$
DECLARE
  rec RECORD;
  v_context TEXT;
BEGIN
  FOR rec IN SELECT id, service_role_key, db_password, management_token FROM adm_clients
  LOOP
    v_context := rec.id::TEXT;

    UPDATE adm_clients SET
      service_role_key = CASE
        WHEN rec.service_role_key IS NOT NULL AND rec.service_role_key != ''
             AND (rec.service_role_key LIKE 'eyJ%' OR length(rec.service_role_key) < 200)
        THEN app_encrypt_secret(rec.service_role_key, v_context)
        ELSE rec.service_role_key
      END,
      db_password = CASE
        WHEN rec.db_password IS NOT NULL AND rec.db_password != ''
             AND length(rec.db_password) < 200
        THEN app_encrypt_secret(rec.db_password, v_context)
        ELSE rec.db_password
      END,
      management_token = CASE
        WHEN rec.management_token IS NOT NULL AND rec.management_token != ''
             AND (rec.management_token LIKE 'sbp_%' OR length(rec.management_token) < 200)
        THEN app_encrypt_secret(rec.management_token, v_context)
        ELSE rec.management_token
      END
    WHERE id = rec.id;
  END LOOP;
END;
$$;
