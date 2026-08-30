-- Fix create_tenant_user: statement timeout and pg_net column compatibility
-- The previous version used net.http_collect_response which blocks and hits
-- Supabase's default 8s statement timeout. Use SET LOCAL to disable it within
-- this function, and poll net._http_response with the correct flat columns.

CREATE OR REPLACE FUNCTION public.create_tenant_user(
  p_email text,
  p_password text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_user_type text DEFAULT 'atendente',
  p_super_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Disable statement timeout for this call — HTTP + polling can exceed 8s default
  SET LOCAL statement_timeout = '30s';

  -- 1. Get credentials from _app_config
  SELECT value INTO v_service_role_key FROM _app_config WHERE key = 'service_role_key';
  SELECT value INTO v_supabase_url FROM _app_config WHERE key = 'supabase_url';

  IF v_service_role_key IS NULL OR v_supabase_url IS NULL THEN
    RETURN jsonb_build_object('error', 'Configuração do tenant incompleta. Contacte o administrador.');
  END IF;

  IF NOT v_service_role_key LIKE 'eyJ%' THEN
    RETURN jsonb_build_object('error', 'Service Role Key inválida (não parece um JWT). Re-salve no ADM.');
  END IF;

  -- 2. Fire async HTTP request to Auth Admin API
  SELECT net.http_post(
    url     := v_supabase_url || '/auth/v1/admin/users',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        v_service_role_key,
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'email',        p_email,
      'password',     p_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object('full_name', p_name)
    )
  ) INTO v_request_id;

  -- 3. Poll for response (flat columns: status_code + body)
  LOOP
    PERFORM pg_sleep(0.5);
    v_attempts := v_attempts + 1;

    BEGIN
      SELECT status_code, body
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    EXCEPTION WHEN undefined_column THEN
      -- Older pg_net uses 'content' instead of 'body'
      SELECT status_code, content
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    END;

    EXIT WHEN v_status IS NOT NULL;
    EXIT WHEN v_attempts >= 20; -- max 10s
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

  -- 4. Insert into settings_users
  INSERT INTO settings_users (auth_user_id, name, email, phone, user_type, super_admin, active)
  VALUES (v_auth_user_id, p_name, p_email, p_phone, p_user_type, p_super_admin, true)
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- 5. Return result
  SELECT jsonb_build_object(
    'success',      true,
    'user_id',      su.id,
    'auth_user_id', v_auth_user_id,
    'email',        p_email,
    'name',         p_name
  ) INTO v_user_record
  FROM settings_users su
  WHERE su.auth_user_id = v_auth_user_id;

  RETURN COALESCE(v_user_record,
    jsonb_build_object('error', 'Usuário criado no Auth mas não encontrado em settings_users'));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_user TO authenticated;
