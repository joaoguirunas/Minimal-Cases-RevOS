-- Rollback RETORNO-06: desativa o cron do ai-callback-worker.
-- Não toca em ai_scheduled_callbacks nem em ai_agent_callback_configs —
-- retornos pendentes ficam 'pending' e disparam normalmente ao religar.

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'ai-callback-worker-1min';
