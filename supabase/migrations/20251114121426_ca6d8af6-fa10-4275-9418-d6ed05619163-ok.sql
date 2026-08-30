-- Atualizar auth_user_id do usuário João
UPDATE public.settings_users
SET 
  auth_user_id = '91743e5c-bc9d-4ec2-8a33-af15b2fcfaaf',
  updated_at = now()
WHERE email = 'joao@receitaprevisivel.ai' AND auth_user_id IS NULL;