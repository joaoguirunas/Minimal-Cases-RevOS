-- Remove a FK antiga que aponta para auth.users
ALTER TABLE public.project_teams
DROP CONSTRAINT IF EXISTS project_teams_created_by_fkey;

-- Atualiza os dados existentes: converte auth.users.id -> settings_users.id
UPDATE public.project_teams t
SET created_by = su.id
FROM public.settings_users su
WHERE t.created_by = su.auth_user_id
  AND t.created_by IS NOT NULL;

-- Remove created_by que não existe em settings_users (evita FK quebrada)
UPDATE public.project_teams t
SET created_by = NULL
WHERE t.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.settings_users su WHERE su.id = t.created_by
  );

-- Cria nova FK apontando para settings_users
ALTER TABLE public.project_teams
ADD CONSTRAINT project_teams_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.settings_users(id) ON DELETE SET NULL;

-- Garante que o criador seja membro admin do time
INSERT INTO public.project_team_members (team_id, user_id, role)
SELECT t.id, t.created_by, 'admin'
FROM public.project_teams t
WHERE t.created_by IS NOT NULL
ON CONFLICT (team_id, user_id) DO NOTHING;