-- =============================================================================
-- Fix: process_message_buffer() — lê config de tabela em vez de current_setting
-- =============================================================================
--
-- PROBLEMA: ALTER DATABASE SET app.supabase_url requer superuser.
-- SOLUÇÃO: Armazenar supabase_url e service_role_key em tabela _app_config,
--          protegida por RLS (só service_role lê), e reescrever a função
--          para SELECT dessa tabela.
--
-- Não requer superuser — roda normalmente via supabase db push / migration.
-- =============================================================================


-- ── 1. Tabela de configuração ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Apenas service_role e superuser podem ler/escrever
ALTER TABLE _app_config ENABLE ROW LEVEL SECURITY;

-- Nenhuma política pública: RLS fecha acesso a roles não-privilegiadas.
-- process_message_buffer() é SECURITY DEFINER → roda como owner (postgres/superuser)
-- e ignora RLS, então consegue SELECT normalmente.


-- ── 2. Inserir / atualizar as credenciais ─────────────────────────────────────

INSERT INTO _app_config (key, value) VALUES
  ('supabase_url',      'https://ohzwetkaazgxafubzvop.supabase.co'),
  ('service_role_key',  'REPLACE_WITH_SERVICE_ROLE_JWT_FROM_VAULT')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ── 3. Recriar process_message_buffer() lendo da tabela ───────────────────────

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
    RAISE NOTICE 'process_message_buffer: _app_config incompleta. Verifique as linhas supabase_url e service_role_key.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT DISTINCT mb.people_id
    FROM   message_buffer mb
    JOIN   clients_people cp ON cp.id = mb.people_id
    WHERE  mb.processed          = false
      AND  mb.expires_at         < now()
      AND  cp.ai_processing_lock = false
      AND  cp.ai_enabled         = true
    FOR UPDATE OF mb SKIP LOCKED
  LOOP
    UPDATE clients_people
      SET ai_processing_lock = true
      WHERE id = rec.people_id;

    PERFORM net.http_post(
      url     := supabase_url || '/functions/v1/ai-agent-execute',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body    := jsonb_build_object('people_id', rec.people_id)::text
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION process_message_buffer() IS
  'Chamada pelo pg_cron a cada minuto. Lê credenciais da tabela _app_config. Encontra buffer entries expiradas, adquire ai_processing_lock e dispara ai-agent-execute via pg_net.';


-- ── 4. Liberar locks presos e limpar buffer orphan ────────────────────────────

UPDATE clients_people
  SET ai_processing_lock = false
  WHERE ai_processing_lock = true;

UPDATE message_buffer
  SET processed = true, processed_at = now()
  WHERE processed = false
    AND created_at < now() - interval '1 hour';
