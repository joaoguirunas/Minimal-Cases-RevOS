-- AUTH-V2-03a AC1: mfa_recovery_codes table
-- Stores bcrypt-hashed recovery codes per user. Plaintext returned once
-- at generation time (mfa_recovery_generate) and never stored.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash        text        NOT NULL,
  recovery_set_id  uuid        NOT NULL,
  used_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: unused codes for a given user
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user_unused
  ON public.mfa_recovery_codes (user_id)
  WHERE used_at IS NULL;

COMMENT ON TABLE public.mfa_recovery_codes IS
  'AUTH-V2-03a: bcrypt-hashed MFA recovery codes. Plaintext returned once at generation, never stored. RPCs: mfa_recovery_generate() / mfa_recovery_consume().';

COMMENT ON COLUMN public.mfa_recovery_codes.code_hash IS
  'bcrypt hash via crypt(plaintext, gen_salt(''bf'', 10)). Constant-time verify: crypt(input, code_hash) = code_hash.';

COMMENT ON COLUMN public.mfa_recovery_codes.recovery_set_id IS
  'Groups codes from the same generation call. All codes in a set are invalidated together on regeneration.';

-- RLS: user sees/deletes only own rows; INSERT/UPDATE via SECURITY DEFINER RPCs
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_recovery_codes_select_own" ON public.mfa_recovery_codes;
CREATE POLICY "mfa_recovery_codes_select_own"
  ON public.mfa_recovery_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mfa_recovery_codes_delete_own" ON public.mfa_recovery_codes;
CREATE POLICY "mfa_recovery_codes_delete_own"
  ON public.mfa_recovery_codes FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
