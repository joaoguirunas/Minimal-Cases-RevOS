-- Desativa pg_cron instagram-token-refresh.
-- System User Token (introduzido no fluxo Meta unificado — meta-1.1/1.2/1.3) não expira.
-- Ver docs/smart-memory/project/audits/meta-simplification-proposal.md §6.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'instagram-token-refresh') THEN
    PERFORM cron.unschedule('instagram-token-refresh');
  END IF;
END $$;
