-- RPC to create a user in auth.users + settings_users
-- Uses service_role_key from _app_config to call Auth Admin API via pg_net/http
-- This avoids the need for an edge function on the tenant project.

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
  v_auth_response jsonb;
  v_auth_user_id uuid;
  v_user_record jsonb;
  v_request_id bigint;
  v_response_status int;
  v_response_body text;
BEGIN
  -- 1. Get service_role_key and supabase_url from _app_config
  SELECT value INTO v_service_role_key FROM _app_config WHERE key = 'service_role_key';
  SELECT value INTO v_supabase_url FROM _app_config WHERE key = 'supabase_url';

  IF v_service_role_key IS NULL OR v_supabase_url IS NULL THEN
    RETURN jsonb_build_object('error', 'Configuração do tenant incompleta. Contacte o administrador.');
  END IF;

  -- 2. Call Supabase Auth Admin API to create user
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

  -- 3. Wait briefly and get response
  -- pg_net is async, but we can poll for the response
  PERFORM pg_sleep(2);

  SELECT status_code, (response).body::text
  INTO v_response_status, v_response_body
  FROM net._http_response
  WHERE id = v_request_id;

  IF v_response_status IS NULL THEN
    -- Retry wait
    PERFORM pg_sleep(3);
    SELECT status_code, (response).body::text
    INTO v_response_status, v_response_body
    FROM net._http_response
    WHERE id = v_request_id;
  END IF;

  IF v_response_status IS NULL OR v_response_status >= 400 THEN
    RETURN jsonb_build_object('error', COALESCE(v_response_body, 'Timeout ao criar usuário no Auth. Tente novamente.'));
  END IF;

  v_auth_response := v_response_body::jsonb;
  v_auth_user_id := (v_auth_response ->> 'id')::uuid;

  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Auth retornou sem ID de usuário');
  END IF;

  -- 4. Insert into settings_users
  INSERT INTO settings_users (auth_user_id, name, email, phone, user_type, super_admin, active)
  VALUES (v_auth_user_id, p_name, p_email, p_phone, p_user_type, p_super_admin, true);

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

  RETURN v_user_record;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Grant execute to authenticated users (gestors will use this)
GRANT EXECUTE ON FUNCTION public.create_tenant_user TO authenticated;
