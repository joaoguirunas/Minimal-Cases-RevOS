-- Rollback for: 20260721120000_retorno_01_scheduled_callbacks.sql
-- Tested-against: PostgreSQL 15 (Supabase wotuyxscsfralqpoiyfv)
-- @allow-destructive reason: rollback de tabelas criadas na própria migration RETORNO-01

BEGIN;

DROP TRIGGER IF EXISTS ai_scheduled_callbacks_set_updated_at ON public.ai_scheduled_callbacks;
DROP TRIGGER IF EXISTS ai_agent_callback_configs_set_updated_at ON public.ai_agent_callback_configs;

DROP TABLE IF EXISTS public.ai_scheduled_callbacks CASCADE;
DROP TABLE IF EXISTS public.ai_agent_callback_configs CASCADE;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260721120000';

COMMIT;
