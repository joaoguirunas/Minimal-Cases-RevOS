-- LP PRO™ — Schema Foundation
-- LPRO-1.1: Tables + RLS + Indexes
-- Created: 2026-02-17
-- Note: module_key='lp' already registered in settings_system_modules (migration 20260217112955)

-- =============================================================================
-- TABLE: lp_templates
-- Global and per-tenant page templates for conversion-optimized landing pages
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lp_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN ('lead_capture', 'consultation', 'product_demo', 'event_registration', 'webinar')),
  thumbnail_url text,
  content       jsonb NOT NULL DEFAULT '{}',
  is_global     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_templates_category
  ON public.lp_templates(category);

CREATE INDEX IF NOT EXISTS idx_lp_templates_is_global
  ON public.lp_templates(is_global);

-- RLS
ALTER TABLE public.lp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_templates_select"
  ON public.lp_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lp_templates_insert"
  ON public.lp_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_gestor());

CREATE POLICY "lp_templates_update"
  ON public.lp_templates FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_gestor());

CREATE POLICY "lp_templates_delete"
  ON public.lp_templates FOR DELETE
  TO authenticated
  USING (public.is_admin_or_gestor());

COMMENT ON TABLE public.lp_templates IS 'LP PRO™: Conversion-optimized landing page templates';

-- =============================================================================
-- TABLE: lp_forms
-- Smart form definitions with dynamic fields, CRM mapping, and conditional logic
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lp_forms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  pipeline_id uuid REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  fields      jsonb NOT NULL DEFAULT '[]',
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_forms_pipeline
  ON public.lp_forms(pipeline_id)
  WHERE pipeline_id IS NOT NULL;

-- RLS
ALTER TABLE public.lp_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_forms_select"
  ON public.lp_forms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lp_forms_insert"
  ON public.lp_forms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_gestor());

CREATE POLICY "lp_forms_update"
  ON public.lp_forms FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_gestor());

CREATE POLICY "lp_forms_delete"
  ON public.lp_forms FOR DELETE
  TO authenticated
  USING (public.is_admin_or_gestor());

COMMENT ON TABLE public.lp_forms IS 'LP PRO™: Smart form definitions with dynamic fields and CRM mapping';
COMMENT ON COLUMN public.lp_forms.fields IS 'Array of field configs: {id, type, label, placeholder, required, crm_field, validation, conditions, order}';
COMMENT ON COLUMN public.lp_forms.settings IS 'Form settings: {submit_text, success_message, redirect_url}';

-- =============================================================================
-- TABLE: lp_pages
-- Landing pages composed of ordered content blocks (stored as JSONB)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lp_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  template_id uuid REFERENCES public.lp_templates(id) ON DELETE SET NULL,
  form_id     uuid REFERENCES public.lp_forms(id) ON DELETE SET NULL,
  content     jsonb NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_pages_status
  ON public.lp_pages(status);

CREATE INDEX IF NOT EXISTS idx_lp_pages_slug
  ON public.lp_pages(slug);

-- RLS
ALTER TABLE public.lp_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_pages_select"
  ON public.lp_pages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lp_pages_insert"
  ON public.lp_pages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_gestor());

CREATE POLICY "lp_pages_update"
  ON public.lp_pages FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_gestor());

CREATE POLICY "lp_pages_delete"
  ON public.lp_pages FOR DELETE
  TO authenticated
  USING (public.is_admin_or_gestor());

COMMENT ON TABLE public.lp_pages IS 'LP PRO™: Landing pages composed of JSONB content blocks';
COMMENT ON COLUMN public.lp_pages.content IS 'Page content: {meta: {title, description}, theme: {primary_color, accent_color, font_family}, blocks: [{id, type, order, data}]}';
COMMENT ON COLUMN public.lp_pages.slug IS 'URL-safe unique identifier for public page access';

-- =============================================================================
-- TABLE: lp_submissions
-- Form submission records with UTM attribution and lead linkage
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lp_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      uuid NOT NULL REFERENCES public.lp_pages(id) ON DELETE CASCADE,
  form_id      uuid NOT NULL REFERENCES public.lp_forms(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES public.leads(id) ON DELETE SET NULL,  -- FK to CRM leads table
  data         jsonb NOT NULL DEFAULT '{}',
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  ip_address   inet,
  user_agent   text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_submissions_page_submitted
  ON public.lp_submissions(page_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_lp_submissions_lead
  ON public.lp_submissions(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lp_submissions_utm_source
  ON public.lp_submissions(utm_source)
  WHERE utm_source IS NOT NULL;

-- RLS
-- Note: INSERT is handled via Edge Function with service role key (anon submissions)
-- Authenticated users (admin/team) can read submissions for analysis
ALTER TABLE public.lp_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_submissions_select"
  ON public.lp_submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lp_submissions_insert"
  ON public.lp_submissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "lp_submissions_delete"
  ON public.lp_submissions FOR DELETE
  TO authenticated
  USING (public.is_admin_or_gestor());

COMMENT ON TABLE public.lp_submissions IS 'LP PRO™: Form submissions with UTM attribution and CRM lead linkage';
COMMENT ON COLUMN public.lp_submissions.data IS 'Raw form field values keyed by field id';
COMMENT ON COLUMN public.lp_submissions.lead_id IS 'FK to leads table — set after CRM upsert via Edge Function';

-- =============================================================================
-- TABLE: lp_analytics_events
-- Page view and form interaction events for conversion funnel analysis
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lp_analytics_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id    uuid NOT NULL REFERENCES public.lp_pages(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('page_view', 'form_view', 'form_start', 'form_submit')),
  session_id text,
  referrer   text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_analytics_page_occurred
  ON public.lp_analytics_events(page_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_lp_analytics_event_type
  ON public.lp_analytics_events(event_type);

-- RLS
-- INSERT via Edge Function (anon public page), SELECT for authenticated team
ALTER TABLE public.lp_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_analytics_events_select"
  ON public.lp_analytics_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lp_analytics_events_insert"
  ON public.lp_analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.lp_analytics_events IS 'LP PRO™: Page view and form interaction events for conversion funnel tracking';

-- =============================================================================
-- TABLE: lp_automation_rules
-- Configurable automation triggers fired after form submission + scoring
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lp_automation_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       uuid REFERENCES public.lp_pages(id) ON DELETE CASCADE,
  name          text NOT NULL,
  trigger_event text NOT NULL DEFAULT 'on_submission',
  conditions    jsonb NOT NULL DEFAULT '[]',
  actions       jsonb NOT NULL DEFAULT '[]',
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_automation_rules_page
  ON public.lp_automation_rules(page_id)
  WHERE page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lp_automation_rules_ativo
  ON public.lp_automation_rules(ativo)
  WHERE ativo = true;

-- RLS
ALTER TABLE public.lp_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_automation_rules_select"
  ON public.lp_automation_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lp_automation_rules_insert"
  ON public.lp_automation_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_gestor());

CREATE POLICY "lp_automation_rules_update"
  ON public.lp_automation_rules FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_gestor());

CREATE POLICY "lp_automation_rules_delete"
  ON public.lp_automation_rules FOR DELETE
  TO authenticated
  USING (public.is_admin_or_gestor());

COMMENT ON TABLE public.lp_automation_rules IS 'LP PRO™: Automation rules triggered after form submission (score threshold, tag match, etc.)';
COMMENT ON COLUMN public.lp_automation_rules.conditions IS 'Array of condition configs: {type: score_gte|tag_contains|always, value}';
COMMENT ON COLUMN public.lp_automation_rules.actions IS 'Array of action configs: {type: send_campaign|move_stage|unlock_schedule|activate_agent|update_field, ...}';

-- =============================================================================
-- FUNCTION + TRIGGERS: updated_at auto-update
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_lp_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lp_pages_updated_at
  BEFORE UPDATE ON public.lp_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_lp_tables_updated_at();

CREATE TRIGGER trg_lp_forms_updated_at
  BEFORE UPDATE ON public.lp_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_lp_tables_updated_at();

-- =============================================================================
-- NOTE: Module registration
-- LP PRO™ is already registered in settings_system_modules:
--   module_key='lp', module_name='LP PRO™', ordem=8, icon='Globe', ativo=true
-- See migration: 20260217112955_add_pro_modules.sql
-- =============================================================================
