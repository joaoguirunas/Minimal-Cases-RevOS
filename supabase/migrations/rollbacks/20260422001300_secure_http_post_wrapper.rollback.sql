-- secure_http_post wrapper — ROLLBACK
-- Reverts 20260422001300_secure_http_post_wrapper.sql

BEGIN;

DROP FUNCTION IF EXISTS public.secure_http_post(text, text, jsonb, text);

COMMIT;
