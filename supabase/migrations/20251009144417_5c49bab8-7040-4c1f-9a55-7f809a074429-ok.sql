-- Adicionar foreign key entre settings_users_teams e settings_users
ALTER TABLE public.settings_users_teams 
ADD CONSTRAINT settings_users_teams_usuario_id_fkey 
FOREIGN KEY (usuario_id) 
REFERENCES public.settings_users(id) 
ON DELETE CASCADE;

-- Adicionar foreign key entre settings_users_teams e settings_teams (se não existir)
ALTER TABLE public.settings_users_teams 
ADD CONSTRAINT settings_users_teams_time_id_fkey 
FOREIGN KEY (time_id) 
REFERENCES public.settings_teams(id) 
ON DELETE CASCADE;