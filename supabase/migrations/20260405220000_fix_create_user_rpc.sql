-- Fix create_tenant_user: pg_net on tenants uses flat columns (body, status_code)
-- not a composite (response).body. Rewrite to avoid net._http_response polling
-- and use net.http_collect_response instead (available in pg_net >= 0.6).
-- Falls back to polling with correct flat column names if needed.

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
  v_response net.http_response_result;
  v_status int;
  v_body text;
BEGIN
  -- 1. Get service_role_key and supabase_url from _app_config
  SELECT value INTO v_service_role_key FROM _app_config WHERE key = 'service_role_key';
  SELECT value INTO v_supabase_url FROM _app_config WHERE key = 'supabase_url';

  IF v_service_role_key IS NULL OR v_supabase_url IS NULL THEN
    RETURN jsonb_build_object('error', 'Configuração do tenant incompleta. Contacte o administrador.');
  END IF;

  -- 2. Fire async HTTP request to Supabase Auth Admin API
  SELECT net.http_post(
    url := v_supabase_url || '/auth/v1/admin/users',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_service_role_key,
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'email', p_email,
      'password', p_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object('full_name', p_name)
    )
  ) INTO v_request_id;

  -- 3. Collect response (blocking, waits up to 5s)
  BEGIN
    SELECT * INTO v_response FROM net.http_collect_response(v_request_id, async := false);
    v_status := v_response.status_code;
    v_body   := v_response.content;
  EXCEPTION WHEN OTHERS THEN
    -- net.http_collect_response not available — fall back to polling
    PERFORM pg_sleep(3);
    BEGIN
      -- pg_net flat columns: status_code, content (or body depending on version)
      SELECT status_code,
             COALESCE(content, body)
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Try alternate column name used in older pg_net versions
      SELECT status_code, response_body::text
        INTO v_status, v_body
        FROM net._http_response
       WHERE id = v_request_id;
    END;
  END;

  IF v_status IS NULL OR v_status >= 400 THEN
    RETURN jsonb_build_object('error', COALESCE(v_body, 'Timeout ou erro ao criar usuário no Auth.'));
  END IF;

  v_auth_user_id := (v_body::jsonb ->> 'id')::uuid;

  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Auth retornou sem ID de usuário');
  END IF;

  -- 4. Insert into settings_users
  INSERT INTO settings_users (auth_user_id, name, email, phone, user_type, super_admin, active)
  VALUES (v_auth_user_id, p_name, p_email, p_phone, p_user_type, p_super_admin, true)
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- 5. Return success
  SELECT jsonb_build_object(
    'success', true,
    'user_id', su.id,
    'auth_user_id', v_auth_user_id,
    'email', p_email,
    'name', p_name
  ) INTO v_user_record
  FROM settings_users su
  WHERE su.auth_user_id = v_auth_user_id;

  RETURN COALESCE(v_user_record, jsonb_build_object('error', 'Usuário criado no Auth mas não encontrado em settings_users'));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_user TO authenticated;
