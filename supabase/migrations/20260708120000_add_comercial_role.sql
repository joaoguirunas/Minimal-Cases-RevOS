-- Adiciona a role 'comercial' — vendedores/closers, sem acesso a BI nem
-- Configurações (nem no menu, nem na rota). Substitui o uso de 'user' pra
-- esse perfil daqui pra frente; 'user' continua existindo (mesmo nível de
-- restrição, corrigido nesta mesma leva de mudanças no frontend).

ALTER TABLE public.settings_users
  DROP CONSTRAINT settings_users_user_type_check;

ALTER TABLE public.settings_users
  ADD CONSTRAINT settings_users_user_type_check
  CHECK (user_type = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text, 'comercial'::text]));
