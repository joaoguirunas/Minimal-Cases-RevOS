-- FIX-AGENT-DUP-03: process_message_buffer() pré-adquire ai_processing_lock antes de
-- chamar ai-agent-execute. Agora sinaliza isso no body com lock_preacquired=true para
-- que a function pule o CAS lock inline (senão veria o lock já em true e abortaria com
-- lock_not_acquired → toda execução via cron ficaria muda).
-- Corpo idêntico ao de 20260308015000_process_buffer_timeout-ok.sql; muda só o body do http_post.
-- Sem DDL, sem novas colunas, timeout continua 30000.

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
      PERFORM net.http_post(
        url                  := supabase_url || '/functions/v1/ai-agent-execute',
        headers              := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || svc_key
        ),
        body                 := jsonb_build_object('people_id', rec.people_id, 'lock_preacquired', true),
        timeout_milliseconds := 30000
      );
    END IF;
  END LOOP;
END;
$$;
