
-- 1. Drop trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop orphaned functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.import_pessoa_with_flexible_lead(text, jsonb, uuid, text);

-- 3. Drop site_* tables
DROP TABLE IF EXISTS public.site_cases_categorias CASCADE;
DROP TABLE IF EXISTS public.site_insights CASCADE;
DROP TABLE IF EXISTS public.site_noticias CASCADE;
DROP TABLE IF EXISTS public.site_cases CASCADE;
DROP TABLE IF EXISTS public.site_candidatos CASCADE;
DROP TABLE IF EXISTS public.site_leads CASCADE;
DROP TABLE IF EXISTS public.site_categorias CASCADE;
