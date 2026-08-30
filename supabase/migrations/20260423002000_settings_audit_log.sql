-- Settings audit log: tracks who changed what and when in tenant settings tables.
-- Sensitive columns (suffix _secret, _key, _token, _password) are stored as SHA-256 hashes.

CREATE TABLE IF NOT EXISTS public.settings_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  section     text NOT NULL,
  field       text NOT NULL,
  old_value   text,
  new_value   text,
  is_sensitive boolean NOT NULL DEFAULT false,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS settings_audit_log_tenant_changed_idx
  ON public.settings_audit_log (tenant_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS settings_audit_log_section_idx
  ON public.settings_audit_log (tenant_id, section);

CREATE INDEX IF NOT EXISTS settings_audit_log_user_idx
  ON public.settings_audit_log (tenant_id, user_id);

ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_audit_log_tenant_read" ON public.settings_audit_log;
CREATE POLICY "settings_audit_log_tenant_read" ON public.settings_audit_log
  FOR SELECT USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- Only edge functions / service_role can INSERT (trigger runs as SECURITY DEFINER)
DROP POLICY IF EXISTS "settings_audit_log_service_insert" ON public.settings_audit_log;
CREATE POLICY "settings_audit_log_service_insert" ON public.settings_audit_log
  FOR INSERT WITH CHECK (true);

-- ── Helper: is this column sensitive? ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_sensitive_column(col_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT col_name ILIKE '%_secret' OR col_name ILIKE '%_key' OR col_name ILIKE '%_token' OR col_name ILIKE '%_password';
$$;

-- ── Helper: format value for audit (hash if sensitive) ───────────────────────
CREATE OR REPLACE FUNCTION public.audit_value(col_name text, val text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN val IS NULL THEN NULL
    WHEN public.is_sensitive_column(col_name) THEN encode(sha256(val::bytea), 'hex')
    ELSE val
  END;
$$;

-- ── Trigger function: settings ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settings_audit_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _tenant_id uuid;
  _user_id   uuid;
  _col       text;
  _old_val   text;
  _new_val   text;
  _section   text := TG_ARGV[0];
BEGIN
  _tenant_id := (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid;
  _user_id   := auth.uid();

  FOREACH _col IN ARRAY (
    SELECT array_agg(column_name::text)
    FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA
      AND table_name   = TG_TABLE_NAME
      AND column_name NOT IN ('id', 'created_at', 'updated_at', 'tenant_id')
  ) LOOP
    EXECUTE format('SELECT ($1).%I::text', _col) INTO _old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::text', _col) INTO _new_val USING NEW;
    IF _old_val IS DISTINCT FROM _new_val THEN
      INSERT INTO public.settings_audit_log
        (tenant_id, user_id, section, field, old_value, new_value, is_sensitive)
      VALUES (
        _tenant_id,
        _user_id,
        _section,
        _col,
        public.audit_value(_col, _old_val),
        public.audit_value(_col, _new_val),
        public.is_sensitive_column(_col)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ── Attach triggers ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS settings_audit ON public.settings;
CREATE TRIGGER settings_audit
  AFTER UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.settings_audit_trigger_fn('geral');

DROP TRIGGER IF EXISTS bi_settings_audit ON public.bi_settings;
CREATE TRIGGER bi_settings_audit
  AFTER UPDATE ON public.bi_settings
  FOR EACH ROW EXECUTE FUNCTION public.settings_audit_trigger_fn('integracoes');

DROP TRIGGER IF EXISTS omni_channel_configs_audit ON public.omni_channel_configs;
CREATE TRIGGER omni_channel_configs_audit
  AFTER UPDATE ON public.omni_channel_configs
  FOR EACH ROW EXECUTE FUNCTION public.settings_audit_trigger_fn('omni');

-- ── pg_cron: delete entries older than 90 days ───────────────────────────────
SELECT cron.schedule(
  'settings_audit_cleanup',
  '0 3 * * *',
  $$DELETE FROM public.settings_audit_log WHERE changed_at < now() - interval '90 days'$$
);
