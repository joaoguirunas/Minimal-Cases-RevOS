-- FWUP-05: Garantir whatsapp_template_id uuid + índice em leads_stages_followups
--
-- Tenants com schema 20251202 têm whatsapp_template_id TEXT sem FK.
-- Tenants com schema 20251005/20251110 podem não ter a coluna.
-- Esta migration normaliza para UUID com FK opcional + índice.

DO $$
DECLARE
  v_col_type text;
BEGIN
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'leads_stages_followups'
    AND column_name  = 'whatsapp_template_id';

  IF v_col_type IS NULL THEN
    -- Coluna não existe: adicionar como uuid com FK
    ALTER TABLE public.leads_stages_followups
      ADD COLUMN whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;
    RAISE NOTICE 'FWUP-05: whatsapp_template_id (uuid) adicionada';

  ELSIF v_col_type = 'text' THEN
    -- Coluna existe como text: converter para uuid (valores legados são nulos em prod)
    ALTER TABLE public.leads_stages_followups
      ALTER COLUMN whatsapp_template_id TYPE uuid USING whatsapp_template_id::uuid;
    ALTER TABLE public.leads_stages_followups
      ADD CONSTRAINT fk_lsf_wa_template
        FOREIGN KEY (whatsapp_template_id) REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;
    RAISE NOTICE 'FWUP-05: whatsapp_template_id convertida de text para uuid com FK';

  ELSE
    RAISE NOTICE 'FWUP-05: whatsapp_template_id já é % — noop', v_col_type;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_stages_fup_wa_template
  ON public.leads_stages_followups (whatsapp_template_id)
  WHERE whatsapp_template_id IS NOT NULL;
