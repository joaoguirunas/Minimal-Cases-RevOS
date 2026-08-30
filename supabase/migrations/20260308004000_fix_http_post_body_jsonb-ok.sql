-- =============================================================================
-- Fix: process_message_buffer() — body para net.http_post deve ser jsonb (não text)
-- =============================================================================
-- net.http_post signature: (url text, body jsonb, params jsonb, headers jsonb, ...)
-- A versão anterior passava body::text → cast implícito pode falhar em alguns contextos.
-- =============================================================================

CREATE OR REPLACE FUNCTION process_message_buffer()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec           record;
  supabase_url  text;
  svc_key       text;
BEGIN
  SELECT value INTO supabase_url FROM _app_config WHERE key = 'supabase_url';
  SELECT value INTO svc_key      FROM _app_config WHERE key = 'service_role_key';

  IF supabase_url IS NULL OR supabase_url = '' OR svc_key IS NULL OR svc_key = '' THEN
    RAISE NOTICE 'process_message_buffer: _app_config incompleta.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT DISTINCT ON (mb.people_id) mb.people_id
    FROM   message_buffer mb
    JOIN   clients_people cp ON cp.id = mb.people_id
    WHERE  mb.processed          = false
      AND  mb.expires_at         < now()
      AND  cp.ai_processing_lock = false
      AND  cp.ai_enabled         = true
    ORDER BY mb.people_id, mb.created_at DESC
  LOOP
    UPDATE clients_people
      SET ai_processing_lock = true
      WHERE id = rec.people_id
        AND ai_processing_lock = false;

    IF FOUND THEN
      -- body é jsonb (não ::text) — alinha com a assinatura real de net.http_post
      PERFORM net.http_post(
        url     := supabase_url || '/functions/v1/ai-agent-execute',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || svc_key
        ),
        body    := jsonb_build_object('people_id', rec.people_id)
      );
    END IF;
  END LOOP;
END;
$$;
