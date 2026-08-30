-- FWUP-22: Fix settings UPDATE failure — Google Calendar + logo em ORA
--
-- Root cause: settings_audit_trigger_fn (migration 136) insere em
-- settings_audit_log com tenant_id NOT NULL. Mas create-tenant-user nunca
-- define app_metadata.tenant_id no JWT dos usuários do tenant → _tenant_id
-- é NULL → INSERT viola NOT NULL → trigger aborta → UPDATE da settings faz
-- rollback com PostgrestError.
--
-- Sintomas em ORA:
--   • Logo:             "Erro ao salvar configurações" + "Erro ao fazer upload"
--   • Google Calendar:  "Erro ao salvar. Tente novamente."
--
-- Fix 1: guard IS NULL no trigger (fail-open — não bloqueia UPDATE quando
--         tenant_id ausente do JWT)
-- Fix 2: ADD COLUMN IF NOT EXISTS para google_client_id / google_client_secret
--         (belt-and-suspenders caso migração 036 não tenha chegado a este tenant)

-- ── 1. Belt-and-suspenders: garantir colunas de OAuth Google ─────────────────
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS google_client_id     text,
  ADD COLUMN IF NOT EXISTS google_client_secret text;

-- ── 2. Harden settings_audit_trigger_fn — bail-out on NULL tenant_id ─────────
-- CREATE OR REPLACE é idempotente; o trigger existente continua apontando
-- para a mesma função — a lógica é apenas substituída.
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

  -- Tenants onde o JWT não carrega app_metadata.tenant_id: não bloquear UPDATE
  IF _tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

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
EXCEPTION WHEN OTHERS THEN
  -- Fallback final: nunca deixar falha de auditoria bloquear UPDATE
  RETURN NEW;
END;
$$;
