-- US-CFG-08: LGPD data export + anonymization

CREATE TABLE IF NOT EXISTS public.data_export_jobs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  requested_by  uuid        REFERENCES public.settings_users(id) ON DELETE SET NULL,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed', 'expired')),
  download_url  text,
  expires_at    timestamptz,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_export_jobs_tenant_id ON public.data_export_jobs(tenant_id, created_at DESC);

ALTER TABLE public.data_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_export_jobs_select ON public.data_export_jobs;
CREATE POLICY data_export_jobs_select ON public.data_export_jobs
  FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS data_export_jobs_insert ON public.data_export_jobs;
CREATE POLICY data_export_jobs_insert ON public.data_export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_user_tenant_id());

-- ── LGPD anonymization log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lgpd_anonymization_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  performed_by  uuid        REFERENCES public.settings_users(id) ON DELETE SET NULL,
  person_id     uuid        NOT NULL,
  tables_affected text[]    NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_anon_log_tenant ON public.lgpd_anonymization_log(tenant_id, created_at DESC);

ALTER TABLE public.lgpd_anonymization_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lgpd_anon_log_select ON public.lgpd_anonymization_log;
CREATE POLICY lgpd_anon_log_select ON public.lgpd_anonymization_log
  FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- ── RPC: anonymize_person ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.anonymize_person(p_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id   uuid;
  v_hash      text;
  v_tables    text[] := '{}';
BEGIN
  -- Require gestor role
  IF (auth.jwt() -> 'app_metadata' ->> 'user_type') != 'gestor' THEN
    RAISE EXCEPTION 'Permission denied: requires gestor role';
  END IF;

  v_tenant_id := public.get_current_user_tenant_id();
  v_user_id   := auth.uid();
  v_hash      := encode(sha256(p_person_id::text::bytea), 'hex');

  -- Anonymize clients_people
  UPDATE public.clients_people
  SET
    name    = 'REDACTED_' || left(v_hash, 8),
    email   = 'redacted_' || left(v_hash, 8) || '@redacted.invalid',
    whatsapp = NULL,
    cpf     = NULL
  WHERE id = p_person_id AND tenant_id = v_tenant_id;

  IF FOUND THEN
    v_tables := array_append(v_tables, 'clients_people');
  END IF;

  -- Anonymize crm_pessoas (legacy)
  UPDATE public.crm_pessoas
  SET
    nome    = 'REDACTED_' || left(v_hash, 8),
    email   = 'redacted_' || left(v_hash, 8) || '@redacted.invalid',
    celular = NULL,
    cpf     = NULL
  WHERE id = p_person_id AND tenant_id = v_tenant_id;

  IF FOUND THEN
    v_tables := array_append(v_tables, 'crm_pessoas');
  END IF;

  -- Anonymize crm_messages content referencing this person (via leads)
  UPDATE public.crm_messages
  SET message = '[conteúdo removido - LGPD]'
  WHERE lead_id IN (
    SELECT id FROM public.crm_leads
    WHERE person_id = p_person_id AND tenant_id = v_tenant_id
  );

  IF FOUND THEN
    v_tables := array_append(v_tables, 'crm_messages');
  END IF;

  -- Anonymize messages (modern schema)
  UPDATE public.messages
  SET message = '[conteúdo removido - LGPD]'
  WHERE lead_id IN (
    SELECT id FROM public.leads
    WHERE person_id = p_person_id AND tenant_id = v_tenant_id
  );

  IF FOUND THEN
    v_tables := array_append(v_tables, 'messages');
  END IF;

  -- Record in log
  INSERT INTO public.lgpd_anonymization_log(tenant_id, performed_by, person_id, tables_affected)
  VALUES (v_tenant_id, v_user_id, p_person_id, v_tables);

  RETURN jsonb_build_object('ok', true, 'tables_affected', v_tables);
END;
$$;
