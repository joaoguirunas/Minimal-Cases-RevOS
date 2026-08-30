-- Rollback: BI-VOICE-03 bi_voice_tool_invocations

SELECT cron.unschedule('bi_voice_tool_invocations_cleanup');

DROP TABLE IF EXISTS public.bi_voice_tool_invocations;
