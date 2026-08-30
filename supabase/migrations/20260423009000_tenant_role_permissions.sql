-- US-CFG-06: Granular role permissions
-- Tenant-scoped roles + feature permissions matrix

-- ── 1. Feature keys enum ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_key') THEN
    CREATE TYPE public.feature_key AS ENUM (
      'crm_export',
      'crm_delete',
      'score_view',
      'coach_view',
      'coach_edit',
      'sends_create',
      'bi_view',
      'settings_view'
    );
  END IF;
END;
$$;

-- ── 2. tenant_roles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL,
  name        text        NOT NULL,
  description text,
  is_system   boolean     NOT NULL DEFAULT false, -- system roles cannot be deleted
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS tenant_roles_tenant_idx ON public.tenant_roles (tenant_id);

ALTER TABLE public.tenant_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_roles_read ON public.tenant_roles;
CREATE POLICY tenant_roles_read ON public.tenant_roles
  FOR SELECT USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_roles_gestor_write ON public.tenant_roles;
CREATE POLICY tenant_roles_gestor_write ON public.tenant_roles
  FOR ALL USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (user_type = 'gestor' OR super_admin = true)
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- ── 3. tenant_role_permissions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_role_permissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     uuid        NOT NULL REFERENCES public.tenant_roles(id) ON DELETE CASCADE,
  feature_key public.feature_key NOT NULL,
  enabled     boolean     NOT NULL DEFAULT true,
  UNIQUE (role_id, feature_key)
);

CREATE INDEX IF NOT EXISTS tenant_role_permissions_role_idx ON public.tenant_role_permissions (role_id);

ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_role_permissions_read ON public.tenant_role_permissions;
CREATE POLICY tenant_role_permissions_read ON public.tenant_role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_roles tr
      WHERE tr.id = role_id
        AND tr.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
  );

DROP POLICY IF EXISTS tenant_role_permissions_gestor_write ON public.tenant_role_permissions;
CREATE POLICY tenant_role_permissions_gestor_write ON public.tenant_role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_roles tr
      WHERE tr.id = role_id
        AND tr.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        AND tr.is_system = false -- system roles' permissions cannot be changed
    )
    AND EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (user_type = 'gestor' OR super_admin = true)
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- ── 4. settings_users: add role_id FK ───────────────────────────────────────
ALTER TABLE public.settings_users
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.tenant_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS settings_users_role_id_idx ON public.settings_users (role_id);

-- ── 5. Seed system roles + default permissions ───────────────────────────────
-- Seeds gestor (all features enabled, system) and atendente (restricted) for
-- the tenant identified by auth.jwt() — only seeds if not already present.
-- Tenants without any rows fall back to hardcoded behavior (backward compat).
CREATE OR REPLACE FUNCTION public.seed_default_tenant_roles(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_gestor_id    uuid;
  v_atendente_id uuid;
  fk             public.feature_key;
BEGIN
  -- Gestor role (system — all features enabled)
  INSERT INTO public.tenant_roles (tenant_id, name, description, is_system)
  VALUES (p_tenant_id, 'gestor', 'Acesso total', true)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_gestor_id;

  IF v_gestor_id IS NOT NULL THEN
    FOR fk IN SELECT unnest(enum_range(NULL::public.feature_key)) LOOP
      INSERT INTO public.tenant_role_permissions (role_id, feature_key, enabled)
      VALUES (v_gestor_id, fk, true)
      ON CONFLICT (role_id, feature_key) DO NOTHING;
    END LOOP;
  END IF;

  -- Atendente role (system — restricted features)
  INSERT INTO public.tenant_roles (tenant_id, name, description, is_system)
  VALUES (p_tenant_id, 'atendente', 'Acesso padrão', true)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_atendente_id;

  IF v_atendente_id IS NOT NULL THEN
    -- Atendente: can view score and BI, cannot export/delete/edit coach/create sends/view settings
    INSERT INTO public.tenant_role_permissions (role_id, feature_key, enabled) VALUES
      (v_atendente_id, 'crm_export',   false),
      (v_atendente_id, 'crm_delete',   false),
      (v_atendente_id, 'score_view',   true),
      (v_atendente_id, 'coach_view',   true),
      (v_atendente_id, 'coach_edit',   false),
      (v_atendente_id, 'sends_create', false),
      (v_atendente_id, 'bi_view',      true),
      (v_atendente_id, 'settings_view',false)
    ON CONFLICT (role_id, feature_key) DO NOTHING;
  END IF;
END;
$$;
