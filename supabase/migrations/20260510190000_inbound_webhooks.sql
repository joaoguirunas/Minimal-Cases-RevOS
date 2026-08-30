-- Inbound webhooks: tokens públicos que recebem leads de fontes externas
-- e os atribuem a um pipeline/stage com mapeamento de campos.

BEGIN;

CREATE TABLE IF NOT EXISTS public.inbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES public.leads_pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  field_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_webhooks_token
  ON public.inbound_webhooks (token);

CREATE INDEX IF NOT EXISTS idx_inbound_webhooks_active
  ON public.inbound_webhooks (active) WHERE active = true;

DROP TRIGGER IF EXISTS update_inbound_webhooks_updated_at ON public.inbound_webhooks;
CREATE TRIGGER update_inbound_webhooks_updated_at
  BEFORE UPDATE ON public.inbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inbound_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select" ON public.inbound_webhooks;
CREATE POLICY "authenticated_select" ON public.inbound_webhooks
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_insert" ON public.inbound_webhooks;
CREATE POLICY "authenticated_insert" ON public.inbound_webhooks
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update" ON public.inbound_webhooks;
CREATE POLICY "authenticated_update" ON public.inbound_webhooks
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_delete" ON public.inbound_webhooks;
CREATE POLICY "authenticated_delete" ON public.inbound_webhooks
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_webhooks TO authenticated;

COMMIT;
