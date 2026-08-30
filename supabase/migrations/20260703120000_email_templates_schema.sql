-- EMAIL-1.1: email_templates library + optional FK on leads_stages_followups.
--
-- Reference architecture: docs/smart-memory/project/email-integration.md (§4)
-- Decision: docs/smart-memory/decisions/ADR-EMAIL-01-reuse-omni-email-channel.md (§Decisão 4)
--
-- Scope: additive only. Creates the reusable HTML email template library and lets a
--   stage follow-up REFERENCE a template (email_template_id, nullable). Existing inline
--   email follow-ups (subject + message) keep working untouched — the FK is opt-in.
--
-- RLS predicate note: WRITE uses user_type = 'manager' (NOT 'gestor'). Live domain is
--   settings_users.user_type CHECK IN ('admin','manager','user'); 'gestor' never matches.
--   This mirrors the ratified fix in 20260702130000_kiwify_rls_manager_fix.sql (several
--   older config tables, incl. omni_channel_configs, still carry the 'gestor' bug).
--
-- Live-verified (2026-07-03, wotuyxscsfralqpoiyfv): email_templates did NOT exist (no
--   ad-hoc drift), update_updated_at_column() exists, leads_stages_followups has no
--   email_template_id column yet.
--
-- Apply: supabase db query --linked --file <this> ; then register in schema_migrations.
-- Rollback: supabase/migrations/rollbacks/20260703120000_email_templates_schema.rollback.sql

BEGIN;

-- ── 1. email_templates (reusable HTML template library) ──────────────────────
CREATE TABLE IF NOT EXISTS public.email_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                       -- internal template name
  subject     text NOT NULL,                       -- subject line (accepts {{var}})
  html_body   text NOT NULL,                        -- HTML body (accepts {{var}})
  variables   text[] NOT NULL DEFAULT '{}',        -- declared vars for preview/validation
  category    text,                                 -- free label (e.g. 'pos-venda','recuperacao')
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.email_templates IS 'Reusable HTML email template library (ADR-EMAIL-01 §4). Referenced optionally by leads_stages_followups.email_template_id; no Meta-style approval. Mirror concept of whatsapp_templates.';
COMMENT ON COLUMN public.email_templates.name IS 'Internal template name shown in the picker/list.';
COMMENT ON COLUMN public.email_templates.subject IS 'Email subject line. Accepts {{var}} tokens rendered by _shared/email-provider.ts.';
COMMENT ON COLUMN public.email_templates.html_body IS 'HTML email body. Accepts {{var}} tokens; lead-supplied values must be escaped at render time.';
COMMENT ON COLUMN public.email_templates.variables IS 'Declared variable names for preview substitution and validation (e.g. {nome,produto}).';
COMMENT ON COLUMN public.email_templates.category IS 'Free-form label to group templates (e.g. pos-venda, recuperacao). Nullable.';
COMMENT ON COLUMN public.email_templates.active IS 'Soft on/off flag; inactive templates are hidden from pickers but not deleted.';

CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. RLS (SELECT = active settings_users; WRITE = manager/super_admin or service_role) ──
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select_active_users" ON public.email_templates;
CREATE POLICY "email_templates_select_active_users" ON public.email_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.settings_users su
            WHERE su.auth_user_id = auth.uid()
              AND su.active = true
              AND su.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "email_templates_write_managers" ON public.email_templates;
CREATE POLICY "email_templates_write_managers" ON public.email_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.settings_users su
            WHERE su.auth_user_id = auth.uid()
              AND su.active = true
              AND su.deleted_at IS NULL
              AND (su.super_admin = true OR su.user_type = 'manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.settings_users su
            WHERE su.auth_user_id = auth.uid()
              AND su.active = true
              AND su.deleted_at IS NULL
              AND (su.super_admin = true OR su.user_type = 'manager'))
  );

DROP POLICY IF EXISTS "email_templates_service_role" ON public.email_templates;
CREATE POLICY "email_templates_service_role" ON public.email_templates
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 3. leads_stages_followups.email_template_id (additive, nullable FK) ───────
ALTER TABLE public.leads_stages_followups
  ADD COLUMN IF NOT EXISTS email_template_id uuid
    REFERENCES public.email_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads_stages_followups.email_template_id IS 'Optional reference to an email_templates row. When set, the follow-up inherits subject+html from the template; when NULL, the inline subject+message HTML is used (backward-compat).';

CREATE INDEX IF NOT EXISTS idx_leads_stages_followups_email_template_id
  ON public.leads_stages_followups(email_template_id)
  WHERE email_template_id IS NOT NULL;

-- ── 4. Seed example template "Compra Aprovada" (unblocks EMAIL-1.6 e2e) ───────
-- Pipeline/product-agnostic. Uses {{nome}} only.
INSERT INTO public.email_templates (name, subject, html_body, variables, category)
SELECT
  'Compra Aprovada',
  'Sua compra foi aprovada 🎉',
  '<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.5"><p>Olá {{nome}},</p><p>Sua compra foi <strong>aprovada</strong> com sucesso! 🎉</p><p>Em instantes você receberá os próximos passos de acesso.</p><p>Qualquer dúvida, é só responder este e-mail.</p></div>',
  ARRAY['nome'],
  'pos-venda'
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE name = 'Compra Aprovada'
);

COMMIT;
