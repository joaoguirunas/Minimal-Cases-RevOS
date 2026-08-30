-- US-CFG-07: White-label — custom_domain, brand colors, product_name

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS custom_domain   text,
  ADD COLUMN IF NOT EXISTS brand_primary_color   varchar(7),
  ADD COLUMN IF NOT EXISTS brand_secondary_color varchar(7),
  ADD COLUMN IF NOT EXISTS product_name    text;

-- Sync custom_domain from settings to adm_clients
-- Called via RPC after saving, using service_role credentials stored in _app_config
CREATE OR REPLACE FUNCTION public.sync_custom_domain_to_adm(p_tenant_id uuid, p_custom_domain text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adm_url  text;
  v_adm_key  text;
BEGIN
  -- Read control plane credentials from _app_config
  SELECT value INTO v_adm_url FROM public._app_config WHERE key = 'supabase_url' LIMIT 1;
  SELECT value INTO v_adm_key FROM public._app_config WHERE key = 'service_role_key' LIMIT 1;

  IF v_adm_url IS NULL OR v_adm_key IS NULL THEN
    RETURN; -- control plane credentials not available, skip sync
  END IF;

  -- Fire-and-forget HTTP update to control plane via pg_net
  PERFORM net.http_patch(
    url    := v_adm_url || '/rest/v1/adm_clients?tenant_id=eq.' || p_tenant_id::text,
    body   := jsonb_build_object('custom_domain', p_custom_domain)::text,
    headers := jsonb_build_object(
      'apikey',        v_adm_key,
      'Authorization', 'Bearer ' || v_adm_key,
      'Content-Type',  'application/json',
      'Prefer',        'return=minimal'
    )
  );
END;
$$;
