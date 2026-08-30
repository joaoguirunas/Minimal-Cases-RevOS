-- FWUP-23: sends_import_presets — Presets de importação de listas para Sends
-- Allows operators to pick a pre-configured field mapping when importing CSV contacts.
-- The preset stores field_mapping (FieldMappingConfig) + lead_control value.

CREATE TABLE IF NOT EXISTS public.sends_import_presets (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text    NOT NULL,
  description  text,
  field_mapping jsonb  NOT NULL DEFAULT '{}',
  lead_control text,   -- value written to leads.control on import (e.g. 'recomendacao')
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sends_import_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sends_import_presets_auth" ON public.sends_import_presets
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_sends_import_presets_updated_at
  BEFORE UPDATE ON public.sends_import_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  public.sends_import_presets IS 'Pre-configured CSV field mappings for lead import in Sends campaigns';
COMMENT ON COLUMN public.sends_import_presets.field_mapping IS 'FieldMappingConfig JSON: {name, whatsapp, crm_extra, lead_extra}';
COMMENT ON COLUMN public.sends_import_presets.lead_control  IS 'Value set on leads.control for all leads imported with this preset';
