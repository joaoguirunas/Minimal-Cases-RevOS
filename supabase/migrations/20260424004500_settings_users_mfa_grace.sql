-- AUTH-V2-03a AC6: settings_users.mfa_grace_until + trigger
-- New users get 7-day grace period when tenant mfa_policy requires their role.
-- Read by AUTH-V2-03b banner — does not block routes.

BEGIN;

ALTER TABLE public.settings_users
  ADD COLUMN IF NOT EXISTS mfa_grace_until timestamptz;

COMMENT ON COLUMN public.settings_users.mfa_grace_until IS
  'AUTH-V2-03a AC6: MFA enrollment deadline. Set to now()+7d on INSERT when tenant mfa_policy requires this role. NULL = no active grace period.';

-- Trigger function: sets grace period based on tenant mfa_policy
CREATE OR REPLACE FUNCTION public.settings_users_set_mfa_grace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy  text;
  v_applies boolean := false;
BEGIN
  SELECT mfa_policy INTO v_policy
    FROM public.settings
   LIMIT 1;

  IF v_policy = 'required_all' THEN
    v_applies := true;
  ELSIF v_policy = 'required_gestores' AND NEW.user_type = 'gestor' THEN
    v_applies := true;
  END IF;

  IF v_applies THEN
    NEW.mfa_grace_until := now() + interval '7 days';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settings_users_mfa_grace ON public.settings_users;

CREATE TRIGGER trg_settings_users_mfa_grace
  BEFORE INSERT ON public.settings_users
  FOR EACH ROW
  EXECUTE FUNCTION public.settings_users_set_mfa_grace();

COMMIT;
