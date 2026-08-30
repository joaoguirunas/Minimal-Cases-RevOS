-- ══════════════════════════════════════════════════════════════════════════════
-- Meeting Follow-up System — CALL PRO™
-- Cadence rules configured in Settings → CALL PRO → Follow-ups
-- Dispatches webhooks at exact scheduled time via pg_cron (every 5 min)
-- Creates crm_messages entries so follow-ups appear in OMNI PRO conversations
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend meetings_followups (add channel, webhook_url, name) ───────────

ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS channel     text NOT NULL DEFAULT 'whatsapp'
                                         CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone')),
  ADD COLUMN IF NOT EXISTS webhook_url text;

COMMENT ON COLUMN public.meetings_followups.name        IS 'Label da regra (ex: Lembrete pré-reunião)';
COMMENT ON COLUMN public.meetings_followups.channel     IS 'Canal de envio: email, sms, whatsapp, phone';
COMMENT ON COLUMN public.meetings_followups.webhook_url IS 'URL do webhook que receberá o disparo (ex: N8N)';

-- ─── 2. Create meeting_followup_queue ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meeting_followup_queue (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          uuid        NOT NULL REFERENCES public.meetings_followups(id) ON DELETE CASCADE,
  meeting_id       uuid        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  people_id        uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  leads_id         uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  scheduled_for    timestamptz NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  channel          text        NOT NULL,
  webhook_url      text        NOT NULL,
  message_snapshot text,
  fired_at         timestamptz,
  response_status  int,
  response_body    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices para a Edge Function processar eficientemente
CREATE INDEX IF NOT EXISTS idx_mfq_status_scheduled
  ON public.meeting_followup_queue (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_mfq_meeting    ON public.meeting_followup_queue (meeting_id);
CREATE INDEX IF NOT EXISTS idx_mfq_rule       ON public.meeting_followup_queue (rule_id);
CREATE INDEX IF NOT EXISTS idx_mfq_people     ON public.meeting_followup_queue (people_id);

COMMENT ON TABLE public.meeting_followup_queue IS
  'Fila de follow-ups agendados por status de reunião. Processada a cada 5 min pela Edge Function process-meeting-followups.';

-- RLS
ALTER TABLE public.meeting_followup_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfq_select" ON public.meeting_followup_queue;
DROP POLICY IF EXISTS "mfq_write"  ON public.meeting_followup_queue;

CREATE POLICY "mfq_select"
  ON public.meeting_followup_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- INSERT/UPDATE gerenciados pelo trigger (service_role) e pela Edge Function
-- Usuário gestor pode cancelar manualmente
CREATE POLICY "mfq_write"
  ON public.meeting_followup_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_admin = true OR user_type = 'gestor')
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- ─── 3. DB Trigger: enqueue follow-ups when meeting status changes ────────────

CREATE OR REPLACE FUNCTION public.handle_meeting_followup_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status    text;
  rule_rec    record;
  delay_secs  bigint;
BEGIN
  -- Skip if status didn't change on UPDATE
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Normalize meetings.status → meetings_followups.meeting_status
  -- meetings uses 'agendada' (fem), meetings_followups uses 'agendado' (masc)
  v_status := CASE NEW.status
    WHEN 'agendada'       THEN 'agendado'
    WHEN 'compareceu'     THEN 'compareceu'
    WHEN 'nao_compareceu' THEN 'nao_compareceu'
    WHEN 'cancelado'      THEN 'cancelado'
    ELSE NEW.status
  END;

  -- Cancel existing pending queue entries for this meeting (status changed)
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.meeting_followup_queue
       SET status = 'cancelled'
     WHERE meeting_id = NEW.id
       AND status = 'pending';
  END IF;

  -- Skip 'cancelado' — no follow-ups for cancelled meetings
  IF v_status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  -- Create queue entry for each active rule matching the new status
  FOR rule_rec IN
    SELECT id, channel, webhook_url, message, days, hours, minutes
      FROM public.meetings_followups
     WHERE active = true
       AND meeting_status = v_status
       AND webhook_url IS NOT NULL
       AND webhook_url <> ''
  LOOP
    delay_secs := (
      COALESCE(rule_rec.days, 0)    * 86400 +
      COALESCE(rule_rec.hours, 0)   * 3600  +
      COALESCE(rule_rec.minutes, 0) * 60
    )::bigint;

    INSERT INTO public.meeting_followup_queue (
      rule_id, meeting_id, people_id, leads_id,
      scheduled_for, channel, webhook_url, message_snapshot
    ) VALUES (
      rule_rec.id,
      NEW.id,
      NEW.people_id,
      NEW.leads_id,
      now() + (delay_secs * interval '1 second'),
      rule_rec.channel,
      rule_rec.webhook_url,
      rule_rec.message
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_meeting_followup_queue ON public.meetings;

CREATE TRIGGER trg_meeting_followup_queue
  AFTER INSERT OR UPDATE OF status
  ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meeting_followup_queue();

-- ─── 4. Add meeting_followup_queue to Supabase Realtime ──────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'meeting_followup_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_followup_queue;
  END IF;
END $$;

ALTER TABLE public.meeting_followup_queue REPLICA IDENTITY FULL;

-- ─── 5. pg_cron: process pending follow-ups every 5 minutes ──────────────────

-- Remove existing job if any
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-meeting-followups';

SELECT cron.schedule(
  'process-meeting-followups',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/process-meeting-followups',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_WITH_SERVICE_ROLE_JWT_FROM_VAULT'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
