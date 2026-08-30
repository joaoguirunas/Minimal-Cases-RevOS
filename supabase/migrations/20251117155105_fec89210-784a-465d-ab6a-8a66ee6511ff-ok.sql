-- Atualizar o usuário joao@receitaprevisivel.ai para super admin

UPDATE public.settings_users
SET super_admin = true
WHERE email = 'joao@receitaprevisivel.ai';