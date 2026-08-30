-- ═══════════════════════════════════════════════════════════════════
-- 20260502120000_user_types_canonical_refactor.sql
-- Brief: Refatora settings_users.user_type para 3 tipos canônicos:
--   admin (super_admin=true), manager (gestor|gerente), user (consultor|atendente|cliente).
--   Atualiza constraint, default, função is_admin_or_manager e ~40 RLS policies
--   que checavam user_type = 'gestor'. Coluna super_admin é mantida por backward compat.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Drop constraint antiga (idempotente) ────────────────────────
ALTER TABLE public.settings_users
  DROP CONSTRAINT IF EXISTS settings_users_user_type_check;

-- ─── 2. Backfill ANTES da nova constraint ───────────────────────────
-- Ordem importa: 'admin' primeiro (super_admin tem prioridade), depois manager, depois user.
UPDATE public.settings_users
   SET user_type = 'admin'
 WHERE super_admin = true
   AND user_type IS DISTINCT FROM 'admin';

UPDATE public.settings_users
   SET user_type = 'manager'
 WHERE super_admin IS NOT TRUE
   AND user_type IN ('gestor', 'gerente');

UPDATE public.settings_users
   SET user_type = 'user'
 WHERE super_admin IS NOT TRUE
   AND (user_type IS NULL OR user_type NOT IN ('admin', 'manager'));

-- ─── 3. Nova constraint canônica ────────────────────────────────────
ALTER TABLE public.settings_users
  ADD CONSTRAINT settings_users_user_type_check
  CHECK (user_type = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text]));

-- ─── 4. Novo default da coluna ──────────────────────────────────────
ALTER TABLE public.settings_users
  ALTER COLUMN user_type SET DEFAULT 'user'::text;

-- ─── 5. Atualizar função is_admin_or_manager ────────────────────────
-- Lógica antiga: super_admin OR user_type='gestor'
-- Lógica nova: super_admin OR user_type IN ('admin','manager')
-- super_admin=true mantido para backward compat.
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.settings_users
    WHERE auth_user_id = auth.uid()
      AND (super_admin = true OR user_type IN ('admin', 'manager'))
      AND active = true
      AND deleted_at IS NULL
  )
$function$;

-- ─── 6. Atualizar default de p_user_type em create_tenant_user ──────
-- Apenas o default do parâmetro precisa mudar; a lógica interna
-- repassa o user_type direto. Caller deve enviar 'admin'|'manager'|'user'.
CREATE OR REPLACE FUNCTION public.create_tenant_user(
  p_email text,
  p_password text,
  p_name text,
  p_phone text DEFAULT NULL::text,
  p_user_type text DEFAULT 'user'::text,
  p_super_admin boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service_role_key text;
  v_supabase_url text;
  v_auth_user_id uuid;
  v_user_record jsonb;
  v_request_id bigint;
  v_status int;
  v_body text;
  v_attempts int := 0;
BEGIN
  SET LOCAL statement_timeout = '30s';

  SELECT value INTO v_service_role_key FROM _app_config WHERE key = 'service_role_key';
  SELECT value INTO v_supabase_url FROM _app_config WHERE key = 'supabase_url';

  IF v_service_role_key IS NULL OR v_supabase_url IS NULL THEN
    RETURN jsonb_build_object('error', 'Configuração do tenant incompleta. Contacte o administrador.');
  END IF;

  IF NOT v_service_role_key LIKE 'eyJ%' THEN
    RETURN jsonb_build_object('error', 'Service Role Key inválida (não parece um JWT). Re-salve no ADM.');
  END IF;

  SELECT net.http_post(
    url     := v_supabase_url || '/auth/v1/admin/users',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        v_service_role_key,
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'email',         p_email,
      'password',      p_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object('full_name', p_name)
    )
  ) INTO v_request_id;

  LOOP
    PERFORM pg_sleep(0.5);
    v_attempts := v_attempts + 1;

    BEGIN
      SELECT status_code, body
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    EXCEPTION WHEN undefined_column THEN
      SELECT status_code, content
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    END;

    EXIT WHEN v_status IS NOT NULL;
    EXIT WHEN v_attempts >= 20;
  END LOOP;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Timeout aguardando resposta do Auth. Tente novamente.');
  END IF;

  IF v_status >= 400 THEN
    RETURN jsonb_build_object('error', COALESCE(
      (v_body::jsonb ->> 'msg'),
      (v_body::jsonb ->> 'message'),
      v_body,
      'Erro ao criar usuário no Auth'
    ));
  END IF;

  v_auth_user_id := (v_body::jsonb ->> 'id')::uuid;

  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Auth retornou sem ID de usuário');
  END IF;

  INSERT INTO settings_users (auth_user_id, name, email, phone, user_type, super_admin, active)
  VALUES (v_auth_user_id, p_name, p_email, p_phone, p_user_type, p_super_admin, true)
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT jsonb_build_object(
    'success',      true,
    'auth_user_id', v_auth_user_id,
    'email',        p_email
  ) INTO v_user_record;

  RETURN v_user_record;
END;
$function$;

-- ─── 7. Atualizar RLS policies que checam user_type = 'gestor' ──────
-- A maioria já usa is_admin_or_manager() (que acabamos de atualizar),
-- mas existem ~40 policies inline que comparam user_type = 'gestor'.
-- Estratégia: substituir cada policy por uma versão que aceita 'admin' OR 'manager'.
-- Em vez de DROP/CREATE individual (frágil — depende do estado real do tenant),
-- aplicamos um DO block que detecta cada policy via pg_policies e regenera o predicate.
--
-- Como as policies usam padrão idêntico, fazemos UPDATE direto em pg_policy.qual / with_check
-- via regenerate utilitário: para cada policy cujo qual contém "user_type = 'gestor'",
-- a recriamos com user_type IN ('admin','manager').

DO $$
DECLARE
  r record;
  v_using_new text;
  v_check_new text;
  v_cmd text;
  v_kind text;
BEGIN
  FOR r IN
    SELECT
      schemaname,
      tablename,
      policyname,
      cmd,
      permissive,
      roles,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%user_type = ''gestor''%' OR with_check LIKE '%user_type = ''gestor''%')
  LOOP
    v_using_new := REPLACE(
      COALESCE(r.qual, ''),
      'user_type = ''gestor''::text',
      'user_type = ANY (ARRAY[''admin''::text, ''manager''::text])'
    );
    v_check_new := REPLACE(
      COALESCE(r.with_check, ''),
      'user_type = ''gestor''::text',
      'user_type = ANY (ARRAY[''admin''::text, ''manager''::text])'
    );

    -- DROP existing policy
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);

    -- Determine command kind
    v_kind := CASE r.cmd
      WHEN 'ALL'    THEN 'ALL'
      WHEN 'SELECT' THEN 'SELECT'
      WHEN 'INSERT' THEN 'INSERT'
      WHEN 'UPDATE' THEN 'UPDATE'
      WHEN 'DELETE' THEN 'DELETE'
      ELSE 'ALL'
    END;

    -- Rebuild policy
    v_cmd := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s',
      r.policyname,
      r.schemaname,
      r.tablename,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      v_kind
    );

    -- Roles (skip TO clause when default {public})
    IF r.roles IS NOT NULL AND array_length(r.roles, 1) > 0
       AND NOT (array_length(r.roles, 1) = 1 AND r.roles[1] = 'public') THEN
      v_cmd := v_cmd || ' TO ' || array_to_string(r.roles, ', ');
    END IF;

    -- USING clause (only when applicable: SELECT/UPDATE/DELETE/ALL)
    IF v_kind IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') AND v_using_new <> '' THEN
      v_cmd := v_cmd || ' USING (' || v_using_new || ')';
    END IF;

    -- WITH CHECK clause (only when applicable: INSERT/UPDATE/ALL)
    IF v_kind IN ('INSERT', 'UPDATE', 'ALL') AND v_check_new <> '' THEN
      v_cmd := v_cmd || ' WITH CHECK (' || v_check_new || ')';
    END IF;

    RAISE NOTICE 'Recreating policy: %.% (%s)', r.tablename, r.policyname, r.cmd;
    EXECUTE v_cmd;
  END LOOP;
END
$$;

COMMIT;
