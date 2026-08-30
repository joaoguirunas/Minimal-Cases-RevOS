-- =============================================
-- FOLLOW-UPS PRO™ v2 — followup_queue table
-- Motor de agendamento e controle de disparos
-- =============================================

-- Guard: garante que meetings_followups existe antes do FK
CREATE TABLE IF NOT EXISTS public.meetings_followups (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_status text        NOT NULL
                             CHECK (meeting_status IN ('agendado', 'compareceu', 'nao_compareceu', 'cancelado')),
  type           text        NOT NULL DEFAULT 'texto',
  message        text,
  subject        text,
  template_id    text,
  audio_file     text,
  days           integer     NOT NULL DEFAULT 0,
  hours          integer     NOT NULL DEFAULT 0,
  minutes        integer     NOT NULL DEFAULT 0,
  active         boolean     NOT NULL DEFAULT true,
  control        integer,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.followup_queue (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referências
  followup_id    uuid        REFERENCES public.leads_stages_followups(id) ON DELETE CASCADE,
  meeting_followup_id uuid   REFERENCES public.meetings_followups(id) ON DELETE CASCADE,
  lead_id        uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  pessoa_id      uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,

  -- Snapshot do canal/conteúdo no momento do agendamento
  canal          text        NOT NULL,
  template_id    text,
  mensagem       text,
  assunto        text,
  phone_number   text,

  -- Origem do job
  source_type    text        NOT NULL DEFAULT 'stage'
                             CHECK (source_type IN ('stage', 'meeting')),

  -- Agendamento
  scheduled_at   timestamptz NOT NULL,
  fired_at       timestamptz,

  -- Status
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'cancelled')),

  -- Resultado
  message_id     bigint      REFERENCES public.messages(id) ON DELETE SET NULL,
  response_data  jsonb,
  error_message  text,
  retry_count    integer     NOT NULL DEFAULT 0,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_followup_queue_updated_at ON public.followup_queue;
CREATE TRIGGER update_followup_queue_updated_at
  BEFORE UPDATE ON public.followup_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_fup_queue_pending
  ON public.followup_queue(scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_fup_queue_lead
  ON public.followup_queue(lead_id);

CREATE INDEX IF NOT EXISTS idx_fup_queue_status
  ON public.followup_queue(status);

CREATE INDEX IF NOT EXISTS idx_fup_queue_created
  ON public.followup_queue(created_at DESC);

-- RLS
ALTER TABLE public.followup_queue ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado ativo
DROP POLICY IF EXISTS "fup_queue_select" ON public.followup_queue;
CREATE POLICY "fup_queue_select"
  ON public.followup_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- INSERT / UPDATE / DELETE: gestor ou service_role
DROP POLICY IF EXISTS "fup_queue_write" ON public.followup_queue;
CREATE POLICY "fup_queue_write"
  ON public.followup_queue FOR ALL
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

COMMENT ON TABLE public.followup_queue IS 'Fila de disparos agendados de follow-ups. Sistema processa entradas com status=pending e scheduled_at <= now().';
COMMENT ON COLUMN public.followup_queue.source_type IS 'Origem: stage=por etapa do pipeline | meeting=por status de reunião';
COMMENT ON COLUMN public.followup_queue.canal IS 'Canal de envio: whatsapp_template, whatsapp_texto, email, sms, ligacao';
COMMENT ON COLUMN public.followup_queue.message_id IS 'Referência à mensagem criada em messages após envio bem-sucedido';
