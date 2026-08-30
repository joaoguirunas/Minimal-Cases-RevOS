-- Criar perfis para usuários que existem no auth mas não têm perfil

INSERT INTO public.settings_users (auth_user_id, name, email, active, super_admin, user_type)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as name,
  au.email,
  true as active,
  false as super_admin,
  'atendente' as user_type
FROM auth.users au
LEFT JOIN public.settings_users su ON su.auth_user_id = au.id
WHERE su.id IS NULL
AND au.email IS NOT NULL
ON CONFLICT (auth_user_id) DO NOTHING;