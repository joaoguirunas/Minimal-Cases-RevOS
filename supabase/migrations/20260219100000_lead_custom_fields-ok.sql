-- Lead Custom Fields — Dynamic field definitions and per-lead values
-- Feature: CRM Pro™ Dynamic Lead Fields
-- Created: 2026-02-19

-- =============================================================================
-- TABLE: lead_field_definitions
-- Admin-configurable field schema (global or per-pipeline)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lead_field_definitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  key           text NOT NULL,                 -- snake_case identifier
  type          text NOT NULL CHECK (type IN ('text', 'number', 'single_select', 'boolean', 'date')),
  category      text NOT NULL CHECK (category IN ('qualificacao', 'outros')),
  pipeline_id   uuid REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,  -- NULL = global
  options       jsonb NOT NULL DEFAULT '[]',   -- [{label, value}] for single_select
  required      boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  ordem         integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Unique field key per pipeline scope (NULLs treated as equal → global fields can't duplicate)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_field_definitions_key_pipeline
  ON public.lead_field_definitions(key, pipeline_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_lead_field_definitions_active
  ON public.lead_field_definitions(active, category, ordem);

CREATE INDEX IF NOT EXISTS idx_lead_field_definitions_pipeline
  ON public.lead_field_definitions(pipeline_id)
  WHERE pipeline_id IS NOT NULL;

-- RLS
ALTER TABLE public.lead_field_definitions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "lead_field_definitions_select" ON public.lead_field_definitions;
DROP POLICY IF EXISTS "lead_field_definitions_insert" ON public.lead_field_definitions;
DROP POLICY IF EXISTS "lead_field_definitions_update" ON public.lead_field_definitions;
DROP POLICY IF EXISTS "lead_field_definitions_delete" ON public.lead_field_definitions;

-- Any authenticated user can read definitions
CREATE POLICY "lead_field_definitions_select"
  ON public.lead_field_definitions FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/gestor can create, update, or delete definitions
CREATE POLICY "lead_field_definitions_insert"
  ON public.lead_field_definitions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_gestor());

CREATE POLICY "lead_field_definitions_update"
  ON public.lead_field_definitions FOR UPDATE
  TO authenticated
  USING (is_admin_or_gestor())
  WITH CHECK (is_admin_or_gestor());

CREATE POLICY "lead_field_definitions_delete"
  ON public.lead_field_definitions FOR DELETE
  TO authenticated
  USING (is_admin_or_gestor());

-- =============================================================================
-- TABLE: lead_field_values
-- Per-lead values for custom fields
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lead_field_values (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_definition_id   uuid NOT NULL REFERENCES public.lead_field_definitions(id) ON DELETE CASCADE,
  value_text            text,
  value_number          numeric,
  value_boolean         boolean,
  value_date            date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, field_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_field_values_lead
  ON public.lead_field_values(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_field_values_definition
  ON public.lead_field_values(field_definition_id);

-- RLS
ALTER TABLE public.lead_field_values ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "lead_field_values_select" ON public.lead_field_values;
DROP POLICY IF EXISTS "lead_field_values_insert" ON public.lead_field_values;
DROP POLICY IF EXISTS "lead_field_values_update" ON public.lead_field_values;
DROP POLICY IF EXISTS "lead_field_values_delete" ON public.lead_field_values;

-- Authenticated users can read and write values
CREATE POLICY "lead_field_values_select"
  ON public.lead_field_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lead_field_values_insert"
  ON public.lead_field_values FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "lead_field_values_update"
  ON public.lead_field_values FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admin/gestor can delete values
CREATE POLICY "lead_field_values_delete"
  ON public.lead_field_values FOR DELETE
  TO authenticated
  USING (is_admin_or_gestor());
