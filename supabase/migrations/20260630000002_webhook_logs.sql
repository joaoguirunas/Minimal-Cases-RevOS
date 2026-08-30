-- webhook_logs: raw log of every inbound webhook received by ManyChat endpoints
-- Captures all requests — including rejected, empty, dedup, and errors — not just saved messages.

BEGIN;

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now() NOT NULL,
  source        text        NOT NULL,          -- 'manychat'
  channel       text,                          -- 'tiktok-manychat', 'instagram-manychat', null if unknown
  event         text        NOT NULL,          -- 'saved' | 'forbidden' | 'empty_text' | 'dedup' | 'no_subscriber_id' | 'error'
  subscriber_id text,
  people_id     uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  message_id    uuid,                          -- soft ref to messages.id (no FK — avoids cascade issues)
  payload       jsonb,
  error_detail  text
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at  ON public.webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_channel     ON public.webhook_logs (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscriber  ON public.webhook_logs (subscriber_id) WHERE subscriber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event       ON public.webhook_logs (event, created_at DESC);

-- Service role only — no direct client access
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
