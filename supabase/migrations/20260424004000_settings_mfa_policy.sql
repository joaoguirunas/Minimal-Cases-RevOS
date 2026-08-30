-- AUTH-V2-03a AC5: settings.mfa_policy enum column + data migration
-- Migrates require_mfa_for_gestores (boolean) → mfa_policy (3-level text enum).
-- Old column kept (deprecated) until UI stops reading it.

BEGIN;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS mfa_policy text
    CHECK (mfa_policy IN ('opt_in', 'required_gestores', 'required_all'))
    DEFAULT 'opt_in';

-- Idempotent data migration from old boolean flag
UPDATE public.settings
   SET mfa_policy = CASE
     WHEN require_mfa_for_gestores = true THEN 'required_gestores'
     ELSE 'opt_in'
   END
 WHERE mfa_policy IS NULL
    OR mfa_policy = 'opt_in';

COMMENT ON COLUMN public.settings.mfa_policy IS
  'MFA enforcement level: opt_in | required_gestores | required_all. Supersedes require_mfa_for_gestores.';

COMMENT ON COLUMN public.settings.require_mfa_for_gestores IS
  'Deprecated 2026-04-24 — use mfa_policy instead. Kept for backwards compatibility until UI is updated.';

COMMIT;
