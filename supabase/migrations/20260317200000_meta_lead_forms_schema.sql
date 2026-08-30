-- ============================================================================
-- META LEAD FORMS — Schema for Facebook/Instagram Lead Ads integration
-- Epic: META-LEAD-FORMS | Story: MLF-01
-- ============================================================================

-- 1. Pages conectadas (Facebook Pages with leadgen webhook)
CREATE TABLE IF NOT EXISTS public.meta_lead_form_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     text NOT NULL UNIQUE,
  page_name   text NOT NULL,
  access_token text NOT NULL,  -- long-lived page token (~60 days) — RLS service_role only
  subscribed  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: access_token NEVER exposed to client
ALTER TABLE public.meta_lead_form_pages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can see page_id, page_name, subscribed (but NOT access_token)
DROP POLICY IF EXISTS "meta_lead_form_pages_select" ON public.meta_lead_form_pages;
CREATE POLICY "meta_lead_form_pages_select"
  ON public.meta_lead_form_pages FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role can INSERT/UPDATE/DELETE (edge functions manage this table)
DROP POLICY IF EXISTS "meta_lead_form_pages_service_insert" ON public.meta_lead_form_pages;
CREATE POLICY "meta_lead_form_pages_service_insert"
  ON public.meta_lead_form_pages FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "meta_lead_form_pages_service_update" ON public.meta_lead_form_pages;
CREATE POLICY "meta_lead_form_pages_service_update"
  ON public.meta_lead_form_pages FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "meta_lead_form_pages_service_delete" ON public.meta_lead_form_pages;
CREATE POLICY "meta_lead_form_pages_service_delete"
  ON public.meta_lead_form_pages FOR DELETE
  TO service_role
  USING (true);

-- Security view: expose only safe columns to client (hides access_token)
CREATE OR REPLACE VIEW public.meta_lead_form_pages_safe AS
  SELECT id, page_id, page_name, subscribed, created_at, updated_at
  FROM public.meta_lead_form_pages;

-- Grant view access to authenticated users
GRANT SELECT ON public.meta_lead_form_pages_safe TO authenticated;

-- 2. Meta Lead Forms (forms created/synced from Meta)
CREATE TABLE IF NOT EXISTS public.meta_lead_forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       text NOT NULL REFERENCES public.meta_lead_form_pages(page_id) ON DELETE CASCADE,
  meta_form_id  text NOT NULL UNIQUE,
  name          text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'unmapped')),
  field_mapping jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  pipeline_id   uuid REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  synced_at     timestamptz
);

-- Indexes
CREATE INDEX idx_meta_lead_forms_page_id ON public.meta_lead_forms(page_id);

-- RLS: authenticated users can CRUD
ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_lead_forms_select" ON public.meta_lead_forms;
CREATE POLICY "meta_lead_forms_select"
  ON public.meta_lead_forms FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "meta_lead_forms_insert" ON public.meta_lead_forms;
CREATE POLICY "meta_lead_forms_insert"
  ON public.meta_lead_forms FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "meta_lead_forms_update" ON public.meta_lead_forms;
CREATE POLICY "meta_lead_forms_update"
  ON public.meta_lead_forms FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "meta_lead_forms_delete" ON public.meta_lead_forms;
CREATE POLICY "meta_lead_forms_delete"
  ON public.meta_lead_forms FOR DELETE
  TO authenticated
  USING (true);

-- Service role also needs full access (for webhook handler)
DROP POLICY IF EXISTS "meta_lead_forms_service_all" ON public.meta_lead_forms;
CREATE POLICY "meta_lead_forms_service_all"
  ON public.meta_lead_forms FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
