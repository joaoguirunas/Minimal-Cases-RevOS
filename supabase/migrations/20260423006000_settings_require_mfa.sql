-- US-CFG-01: MFA — require_mfa_for_gestores setting

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS require_mfa_for_gestores boolean DEFAULT false;
