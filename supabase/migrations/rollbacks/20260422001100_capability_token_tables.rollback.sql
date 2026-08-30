-- Capability Token Tables — ROLLBACK
-- Reverts 20260422001100_capability_token_tables.sql

BEGIN;

DROP TABLE IF EXISTS public.action_token_consumed;
DROP TABLE IF EXISTS public.booking_token_jti_usage;

COMMIT;
