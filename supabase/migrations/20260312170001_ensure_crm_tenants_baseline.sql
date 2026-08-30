-- Bootstrap guard: ensure crm_tenants exists on tenant projects.
-- The original crm_tenants table was created by a series of pre-manifest legacy migrations
-- (UUID format, timestamps 20250624–20250920) that are excluded from client-migrations.json
-- by the epoch filter (< 20260312). Existing tenants already have the table from those
-- migrations. New tenants provisioned after the manifest epoch would not — this migration
-- closes that gap idempotently.
--
-- Order: 000 (inserted at epoch start, before all other epoch migrations depend on crm_tenants).

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_tenants (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  value           text        NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  modulos_ativos  jsonb       DEFAULT '{"visitas": false, "reservas": false, "reunioes": false, "campanhas": false}'::jsonb,
  webhook_conversas text      CHECK (webhook_conversas IS NULL OR webhook_conversas ~ '^https?://[^\s/$.?#].[^\s]*$'),
  disc_config     jsonb       DEFAULT '{"model": "gpt-4o-mini", "api_key": null, "enabled": false, "temperature": 0.7}'::jsonb,
  resumo_config   jsonb       DEFAULT '{"model": "gpt-4o-mini", "api_key": null, "enabled": false, "temperature": 0.7}'::jsonb,
  ativo           boolean     NOT NULL DEFAULT true,
  logo_url        text,
  CONSTRAINT crm_tenants_pkey PRIMARY KEY (id)
);

-- Columns added by post-baseline legacy migrations (idempotent)
ALTER TABLE public.crm_tenants
  ADD COLUMN IF NOT EXISTS tenant_slug     text,
  ADD COLUMN IF NOT EXISTS primary_color   text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

ALTER TABLE public.crm_tenants ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read their own tenant row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_tenants' AND policyname = 'crm_tenants_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY crm_tenants_select_own ON public.crm_tenants
      FOR SELECT TO authenticated
      USING (id = (auth.jwt() -> ''app_metadata'' ->> ''tenant_id'')::uuid)';
  END IF;
END;
$$;

COMMIT;
