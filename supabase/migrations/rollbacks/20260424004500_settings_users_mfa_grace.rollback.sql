DROP TRIGGER IF EXISTS trg_settings_users_mfa_grace ON public.settings_users;
DROP FUNCTION IF EXISTS public.settings_users_set_mfa_grace();
ALTER TABLE public.settings_users DROP COLUMN IF EXISTS mfa_grace_until;
