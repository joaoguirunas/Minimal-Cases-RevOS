-- AUTH-V2-03a AC2+AC3: RPCs mfa_recovery_generate + mfa_recovery_consume
-- pgcrypto confirmed available via 20260325210000_adm_secrets_encryption.sql.
--
-- QA manual:
--   SELECT mfa_recovery_generate();
--   SELECT mfa_recovery_consume('XXXX-XXXX-XXXX-XXXX');

BEGIN;

-- ── AC2: mfa_recovery_generate ────────────────────────────────────────────────
-- Returns 10 plaintext codes (XXXX-XXXX-XXXX-XXXX) for the calling user.
-- Requires authenticated caller with enrolled TOTP factor.
-- Deletes all unused codes from prior sets before inserting new ones.

CREATE OR REPLACE FUNCTION public.mfa_recovery_generate()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_set_id    uuid := gen_random_uuid();
  v_codes     text[] := '{}';
  v_plaintext text;
  v_has_totp  boolean;
  i           int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller has an enrolled TOTP factor
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = v_user_id
      AND factor_type = 'totp'
      AND status = 'verified'
  ) INTO v_has_totp;

  IF NOT v_has_totp THEN
    RAISE EXCEPTION 'MFA TOTP not enrolled for this user';
  END IF;

  -- Invalidate previous unused codes
  DELETE FROM public.mfa_recovery_codes
   WHERE user_id = v_user_id
     AND used_at IS NULL;

  -- Generate 10 codes: XXXX-XXXX-XXXX-XXXX (4 groups of 4 hex chars, uppercase)
  FOR i IN 1..10 LOOP
    v_plaintext :=
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4)) || '-' ||
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4)) || '-' ||
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4)) || '-' ||
      upper(substring(encode(gen_random_bytes(2), 'hex'), 1, 4));

    INSERT INTO public.mfa_recovery_codes (user_id, code_hash, recovery_set_id)
    VALUES (
      v_user_id,
      extensions.crypt(v_plaintext, extensions.gen_salt('bf', 10)),
      v_set_id
    );

    v_codes := array_append(v_codes, v_plaintext);
  END LOOP;

  RETURN v_codes;
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_recovery_generate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mfa_recovery_generate() FROM anon;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_generate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_generate() TO service_role;

COMMENT ON FUNCTION public.mfa_recovery_generate() IS
  'AUTH-V2-03a AC2: Generates 10 bcrypt-hashed recovery codes for the calling user. Requires enrolled TOTP. Invalidates prior unused codes. Plaintext returned ONCE.';

-- ── AC3: mfa_recovery_consume ─────────────────────────────────────────────────
-- Validates a recovery code via constant-time bcrypt comparison.
-- Returns true on match (marks used_at + audit log), false otherwise.
-- Does NOT issue a session — caller manages auth flow (AUTH-V2-03c).

CREATE OR REPLACE FUNCTION public.mfa_recovery_consume(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row     public.mfa_recovery_codes%ROWTYPE;
  v_matched boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR v_row IN
    SELECT * FROM public.mfa_recovery_codes
     WHERE user_id = v_user_id
       AND used_at IS NULL
     ORDER BY created_at
  LOOP
    IF extensions.crypt(p_code, v_row.code_hash) = v_row.code_hash THEN
      UPDATE public.mfa_recovery_codes
         SET used_at = now()
       WHERE id = v_row.id;

      INSERT INTO public.adm_audit_log (actor_id, action, details)
      VALUES (
        v_user_id,
        'mfa.recovery_consumed',
        jsonb_build_object(
          'code_id',          v_row.id,
          'recovery_set_id',  v_row.recovery_set_id
        )
      );

      v_matched := true;
      EXIT;
    END IF;
  END LOOP;

  RETURN v_matched;
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_recovery_consume(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mfa_recovery_consume(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_consume(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_consume(text) TO service_role;

COMMENT ON FUNCTION public.mfa_recovery_consume(text) IS
  'AUTH-V2-03a AC3: Validates a recovery code (constant-time bcrypt). Marks used_at on match. Returns false for invalid/used codes. Does NOT issue a session.';

COMMIT;
