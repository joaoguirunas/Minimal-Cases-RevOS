-- Secret Access Log — ROLLBACK
-- Reverts 20260422001200_secret_access_log.sql

BEGIN;

DROP TABLE IF EXISTS public.secret_access_log;

COMMIT;
