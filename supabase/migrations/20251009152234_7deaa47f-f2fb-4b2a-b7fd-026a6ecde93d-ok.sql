-- Adicionar foreign key entre meetings e settings_users
ALTER TABLE public.meetings 
ADD CONSTRAINT meetings_users_id_fkey 
FOREIGN KEY (users_id) 
REFERENCES public.settings_users(id) 
ON DELETE SET NULL;