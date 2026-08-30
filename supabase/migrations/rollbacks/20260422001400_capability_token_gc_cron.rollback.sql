-- Capability Token GC Cron — ROLLBACK
-- Reverts 20260422001400_capability_token_gc_cron.sql

SELECT cron.unschedule('capability-token-gc');
