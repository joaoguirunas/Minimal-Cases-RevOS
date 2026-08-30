-- Rollback: AUTH-V2-03c-fixup
-- Restores mfa_recovery_consume to the pre-atomic version (returns boolean, no factor delete).

BEGIN;

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
