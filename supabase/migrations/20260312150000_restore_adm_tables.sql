-- ================================================================
-- MIGRATION: 20260312150000_restore_adm_tables.sql
-- Restaura adm_clients, adm_sync_jobs e adm_sync_logs
-- que foram dropadas por engano na 20260312120000_db_cleanup_audit
-- (foram consideradas resíduo multi-tenant mas são usadas pelo
--  painel ADM Control Plane — /adm)
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- adm_clients — registro de clientes gerenciados
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adm_clients (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  slug             TEXT        NOT NULL UNIQUE,
  supabase_url     TEXT        NOT NULL,
  anon_key         TEXT        NOT NULL,
  service_role_key TEXT,
  db_password      TEXT,
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','inactive','suspended')),
  sync_status      TEXT        NOT NULL DEFAULT 'never'
                               CHECK (sync_status IN ('never','pending','syncing','synced','error')),
  last_synced_at   TIMESTAMPTZ,
  contact_name     TEXT,
  contact_email    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- adm_sync_jobs — jobs de sincronização de banco por cliente
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adm_sync_jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID        NOT NULL REFERENCES public.adm_clients (id) ON DELETE CASCADE,
  triggered_by   TEXT        NOT NULL DEFAULT 'manual'
                             CHECK (triggered_by IN ('manual','auto','github_actions','webhook')),
  type           TEXT        NOT NULL DEFAULT 'full'
                             CHECK (type IN ('full','migrations','functions')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','running','success','failed','cancelled')),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- adm_sync_logs — log detalhado linha a linha de cada job
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adm_sync_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID        NOT NULL REFERENCES public.adm_sync_jobs (id) ON DELETE CASCADE,
  level      TEXT        NOT NULL DEFAULT 'info'
                         CHECK (level IN ('info','warning','error','success')),
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- Índices de performance
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_adm_sync_jobs_client_id
  ON public.adm_sync_jobs (client_id);

CREATE INDEX IF NOT EXISTS idx_adm_sync_jobs_status
  ON public.adm_sync_jobs (status);

CREATE INDEX IF NOT EXISTS idx_adm_sync_logs_job_id
  ON public.adm_sync_logs (job_id);

-- ────────────────────────────────────────────────────────────────
-- Updated_at automático para adm_clients
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_adm_clients_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adm_clients_updated_at ON public.adm_clients;
CREATE TRIGGER trg_adm_clients_updated_at
  BEFORE UPDATE ON public.adm_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_adm_clients_updated_at();

-- ────────────────────────────────────────────────────────────────
-- RLS — acesso exclusivo a super_admin
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.adm_clients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_sync_logs ENABLE ROW LEVEL SECURITY;

-- adm_clients
DROP POLICY IF EXISTS "adm_clients_super_admin" ON public.adm_clients;
CREATE POLICY "adm_clients_super_admin"
  ON public.adm_clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND super_admin = true
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- adm_sync_jobs
DROP POLICY IF EXISTS "adm_sync_jobs_super_admin" ON public.adm_sync_jobs;
CREATE POLICY "adm_sync_jobs_super_admin"
  ON public.adm_sync_jobs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND super_admin = true
        AND active = true
        AND deleted_at IS NULL
    )
  );

-- adm_sync_logs
DROP POLICY IF EXISTS "adm_sync_logs_super_admin" ON public.adm_sync_logs;
CREATE POLICY "adm_sync_logs_super_admin"
  ON public.adm_sync_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND super_admin = true
        AND active = true
        AND deleted_at IS NULL
    )
  );

COMMIT;
