-- ROLLBACK: tl;dv Integration
-- Migration: 20260421180000_tldv_integration

-- ── 1. Remover pg_cron job ────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tldv-daily-sync') THEN
    PERFORM cron.unschedule('tldv-daily-sync');
  END IF;
END $$;

DROP FUNCTION IF EXISTS trigger_tldv_daily_sync();

-- ── 2. Remover seed tl;dv de omni_channel_configs ────────────────────────────
DELETE FROM public.omni_channel_configs WHERE channel = 'tldv';

-- ── 3. Restaurar CHECK constraint original (sem 'tldv') ──────────────────────
ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;

ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'email', 'sms', 'telefone'));

-- ── 4. Remover índice e colunas de meeting_records ───────────────────────────
DROP INDEX IF EXISTS public.idx_meeting_records_tldv_id;

ALTER TABLE public.meeting_records
  DROP COLUMN IF EXISTS highlights,
  DROP COLUMN IF EXISTS transcript_json,
  DROP COLUMN IF EXISTS tldv_meeting_id;
