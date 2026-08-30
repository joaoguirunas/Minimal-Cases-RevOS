-- =============================================
-- Create meetings_followups table if missing
-- (migration 20251005 may not have been applied)
-- =============================================

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

-- Trigger (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'update_meetings_followups_updated_at'
       AND tgrelid = 'public.meetings_followups'::regclass
  ) THEN
    CREATE TRIGGER update_meetings_followups_updated_at
      BEFORE UPDATE ON public.meetings_followups
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Garantir coluna control em tabelas pré-existentes
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS control integer;

ALTER TABLE public.meetings_followups ENABLE ROW LEVEL SECURITY;

-- RLS
DROP POLICY IF EXISTS "meetings_followups_access_policy" ON public.meetings_followups;
DROP POLICY IF EXISTS "meet_fup_select"                  ON public.meetings_followups;
DROP POLICY IF EXISTS "meet_fup_write"                   ON public.meetings_followups;

CREATE POLICY "meet_fup_select"
  ON public.meetings_followups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "meet_fup_write"
  ON public.meetings_followups FOR ALL
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

COMMENT ON TABLE public.meetings_followups IS 'Follow-ups automáticos disparados por status de reunião';
