-- Update the check constraint on settings_users to include 'cliente' as valid user_type
ALTER TABLE public.settings_users DROP CONSTRAINT IF EXISTS settings_users_user_type_check;

ALTER TABLE public.settings_users ADD CONSTRAINT settings_users_user_type_check 
CHECK (user_type IN ('gestor', 'consultor', 'atendente', 'cliente', 'gerente'));