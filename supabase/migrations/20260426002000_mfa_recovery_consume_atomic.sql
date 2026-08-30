-- AUTH-V2-03c-fixup AC1: make mfa_recovery_consume atomic
-- Adds DELETE FROM auth.mfa_factors inside the same transaction that marks used_at.
-- SECURITY DEFINER with service_role bypasses Supabase MFA AAL2 enforcement,
-- which would otherwise block unenroll when the caller's JWT is AAL1 (recovery flow).
-- AC4: if no totp factor found, rolls back and returns { success, error } jsonb.

BEGIN;

-- Drop first: return type changes boolean→jsonb, CREATE OR REPLACE cannot change return type
DROP FUNCTION IF EXISTS public.mfa_recovery_consume(text);

CREATE OR REPLACE FUNCTION public.mfa_recovery_consume(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_row        public.mfa_recovery_codes%ROWTYPE;
  v_matched    boolean := false;
  v_factor_id  uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Find and consume a matching unused recovery code (constant-time bcrypt)
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

      v_matched := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_matched THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- 2. Resolve the user's totp factor id
  SELECT id INTO v_factor_id
    FROM auth.mfa_factors
   WHERE user_id    = v_user_id
     AND factor_type = 'totp'
   LIMIT 1;

  IF v_factor_id IS NULL THEN
    -- Code was valid but factor already absent — roll back used_at to keep code reusable
    RAISE EXCEPTION 'factor_not_found';
  END IF;

  -- 3. Delete the totp factor atomically (service_role bypasses AAL2 enforcement)
  DELETE FROM auth.mfa_factors
   WHERE id      = v_factor_id
     AND user_id = v_user_id;

  -- 4. Audit log
  INSERT INTO public.adm_audit_log (actor_id, action, details)
  VALUES (
    v_user_id,
    'mfa.recovery_consumed',
    jsonb_build_object(
      'code_id',         v_row.id,
      'recovery_set_id', v_row.recovery_set_id,
      'factor_id',       v_factor_id
    )
  );

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    -- Rolls back used_at update + factor delete automatically (same transaction)
    IF SQLERRM = 'factor_not_found' THEN
      RETURN jsonb_build_object('success', false, 'error', 'factor_not_found');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_recovery_consume(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mfa_recovery_consume(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_consume(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_consume(text) TO service_role;

COMMENT ON FUNCTION public.mfa_recovery_consume(text) IS
  'AUTH-V2-03c-fixup AC1: Validates recovery code + deletes totp factor atomically (SECURITY DEFINER). Returns jsonb {success, error?}. Replaces boolean return of AUTH-V2-03a.';

COMMIT;
