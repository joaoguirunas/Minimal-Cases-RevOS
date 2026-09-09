-- EMAIL-VERSIONS — histórico de versões dos templates de e-mail (snapshot do estado anterior a cada UPDATE de conteúdo).
BEGIN;
CREATE TABLE IF NOT EXISTS public.email_template_versions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  name        text,
  subject     text NOT NULL,
  html_body   text NOT NULL,
  variables   text[] NOT NULL DEFAULT '{}',
  saved_by    uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_template_versions_tpl_idx ON public.email_template_versions (template_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.email_templates_snapshot_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF OLD.html_body IS DISTINCT FROM NEW.html_body OR OLD.subject IS DISTINCT FROM NEW.subject OR OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.email_template_versions (template_id, name, subject, html_body, variables, saved_by)
    VALUES (OLD.id, OLD.name, OLD.subject, OLD.html_body, COALESCE(OLD.variables, '{}'), auth.uid());
    DELETE FROM public.email_template_versions
     WHERE template_id = OLD.id AND id NOT IN (
       SELECT id FROM public.email_template_versions WHERE template_id = OLD.id ORDER BY created_at DESC, id DESC LIMIT 30);
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS email_templates_snapshot_version ON public.email_templates;
CREATE TRIGGER email_templates_snapshot_version
  BEFORE UPDATE OF name, subject, html_body ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.email_templates_snapshot_version();

ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS etv_select ON public.email_template_versions;
CREATE POLICY etv_select ON public.email_template_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL));
DROP POLICY IF EXISTS etv_delete_managers ON public.email_template_versions;
CREATE POLICY etv_delete_managers ON public.email_template_versions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.settings_users su WHERE su.auth_user_id = auth.uid() AND su.active = true AND su.deleted_at IS NULL
          AND (su.super_admin = true OR su.user_type = 'manager')));
DROP POLICY IF EXISTS etv_service ON public.email_template_versions;
CREATE POLICY etv_service ON public.email_template_versions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
COMMIT;
