-- =============================================================================
-- Fix: process_message_buffer() — remove DISTINCT incompatível com FOR UPDATE
-- =============================================================================
--
-- ERRO: "FOR UPDATE is not allowed with DISTINCT clause"
-- CAUSA: SELECT DISTINCT + FOR UPDATE é inválido no PostgreSQL.
-- FIX:   Usar subquery para deduplica people_id antes do loop,
--        sem FOR UPDATE (o ai_processing_lock já garante exclusão mútua).
--
-- ALSO:  Atualiza agente "Diagnóstico" com llm_provider_id correto.
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

  -- Fix: sem DISTINCT + FOR UPDATE (incompatíveis).
  -- Usa subquery para pegar people_id únicos com buffer expirado e não processado.
  -- ai_processing_lock garante que apenas um worker por pessoa rode ao mesmo tempo.
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
    -- Adquire lock antes de disparar o agente
    UPDATE clients_people
      SET ai_processing_lock = true
      WHERE id = rec.people_id
        AND ai_processing_lock = false;  -- guard extra para race condition

    -- Só dispara se conseguiu o lock
    IF FOUND THEN
      PERFORM net.http_post(
        url     := supabase_url || '/functions/v1/ai-agent-execute',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || svc_key
        ),
        body    := jsonb_build_object('people_id', rec.people_id)::text
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION process_message_buffer() IS
  'Chamada pelo pg_cron a cada minuto. Usa DISTINCT ON para deduplica people_id sem FOR UPDATE. Adquire ai_processing_lock antes de disparar ai-agent-execute via pg_net.';


-- Associar o agente "Diagnóstico" ao provider OpenAI disponível
UPDATE ai_agents
  SET llm_provider_id = '659a1ece-dbdc-4fb0-8057-2fc150099584'
  WHERE id = 'd0c29089-b294-4631-8a2e-fafd95743da5'
    AND llm_provider_id IS NULL;
