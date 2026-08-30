-- =============================================
-- FOLLOW-UPS PRO™ v2 — Schema enhancements
-- Fase 1: Multi-channel + RLS fix + control col
-- =============================================

-- 1. Garantir coluna control (pode já existir)
ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS control integer;

-- 2. Garantir coluna score_matrix_id (pode já existir)
ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS score_matrix_id uuid REFERENCES public.score_matrix(id) ON DELETE SET NULL;

-- 3. Garantir coluna target_stage_id (pode já existir)
ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS target_stage_id uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL;

-- 4. Corrigir RLS da tabela leads_stages_followups (era USING (true) — inseguro)
DROP POLICY IF EXISTS "leads_stages_followups_access_policy" ON public.leads_stages_followups;
DROP POLICY IF EXISTS "authenticated_read"                    ON public.leads_stages_followups;
DROP POLICY IF EXISTS "authenticated_write"                   ON public.leads_stages_followups;
DROP POLICY IF EXISTS "Enable all operations"                 ON public.leads_stages_followups;

-- SELECT: qualquer usuário autenticado ativo
DROP POLICY IF EXISTS "fup_rules_select" ON public.leads_stages_followups;
CREATE POLICY "fup_rules_select"
  ON public.leads_stages_followups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- INSERT / UPDATE / DELETE: apenas gestor / super_admin
DROP POLICY IF EXISTS "fup_rules_write" ON public.leads_stages_followups;
CREATE POLICY "fup_rules_write"
  ON public.leads_stages_followups FOR ALL
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

-- 5. Criar meetings_followups se não existir (pode não ter sido aplicada em produção)
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

-- Trigger updated_at (apenas se a tabela foi recém-criada; idempotente)
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

-- Garantir coluna control (caso a tabela já existia sem ela)
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS control integer;

-- Habilitar RLS (idempotente em tabelas já existentes)
ALTER TABLE public.meetings_followups ENABLE ROW LEVEL SECURITY;

-- 6. Corrigir RLS de meetings_followups
DROP POLICY IF EXISTS "meetings_followups_access_policy" ON public.meetings_followups;

DROP POLICY IF EXISTS "meet_fup_select" ON public.meetings_followups;
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

DROP POLICY IF EXISTS "meet_fup_write" ON public.meetings_followups;
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

-- Comentários
COMMENT ON COLUMN public.leads_stages_followups.control   IS 'Número de controle para routing N8N (step execution)';
COMMENT ON COLUMN public.leads_stages_followups.target_stage_id IS 'Etapa destino opcional: lead é movido após envio';
COMMENT ON TABLE  public.meetings_followups               IS 'Follow-ups automáticos disparados por status de reunião';
