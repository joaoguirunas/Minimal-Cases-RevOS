-- Fix the database trigger cascade issue
DROP TRIGGER IF EXISTS prevent_duplicate_messages ON crm_messages CASCADE;
DROP FUNCTION IF EXISTS prevent_message_duplicates() CASCADE;

-- Create the new improved trigger
CREATE OR REPLACE FUNCTION prevent_message_duplicates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar duplicatas ignorando usuario_id completamente
  -- Usar apenas: lead_id, message (trim), from_message e janela temporal de 30 segundos
  IF EXISTS (
    SELECT 1 FROM crm_messages 
    WHERE lead_id = NEW.lead_id 
    AND TRIM(message) = TRIM(NEW.message)
    AND from_message = NEW.from_message
    AND ABS(EXTRACT(EPOCH FROM (created_at - NEW.created_at))) < 30
    AND id != COALESCE(NEW.id, 0)
  ) THEN
    RAISE LOG 'TRIGGER: Mensagem duplicata bloqueada - lead_id: %, message: %, from: %', 
      NEW.lead_id, LEFT(TRIM(NEW.message), 50), NEW.from_message;
    RETURN NULL; -- Bloqueia a inserção
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER prevent_message_duplicates_trigger
  BEFORE INSERT ON crm_messages
  FOR EACH ROW
  EXECUTE FUNCTION prevent_message_duplicates();

-- LIMPEZA DE DUPLICATAS EXISTENTES
-- Identificar e remover mensagens duplicatas com usuario_id NULL
WITH duplicates_to_remove AS (
  SELECT 
    m1.id,
    m1.message,
    m1.from_message,
    m1.lead_id,
    m1.usuario_id,
    m1.created_at
  FROM crm_messages m1
  INNER JOIN crm_messages m2 ON (
    m1.lead_id = m2.lead_id 
    AND TRIM(m1.message) = TRIM(m2.message)
    AND m1.from_message = m2.from_message
    AND ABS(EXTRACT(EPOCH FROM (m1.created_at - m2.created_at))) < 60
    AND m1.id != m2.id
  )
  WHERE m1.usuario_id IS NULL 
  AND m2.usuario_id IS NOT NULL
  AND m1.created_at > m2.created_at - INTERVAL '2 minutes'
  AND m1.created_at < m2.created_at + INTERVAL '2 minutes'
)
DELETE FROM crm_messages 
WHERE id IN (SELECT id FROM duplicates_to_remove);

-- ADICIONAR FUNÇÃO DE MONITORAMENTO
CREATE OR REPLACE FUNCTION log_message_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log detalhado para monitorar criação de mensagens
  RAISE LOG 'NOVA MENSAGEM: id=%, lead_id=%, from=%, usuario_id=%, message=%, tenant_id=%', 
    NEW.id, NEW.lead_id, NEW.from_message, NEW.usuario_id, LEFT(NEW.message, 50), NEW.tenant_id;
  
  RETURN NEW;
END;
$$;

-- Criar trigger de monitoramento
DROP TRIGGER IF EXISTS log_message_creation_trigger ON crm_messages;
CREATE TRIGGER log_message_creation_trigger
  AFTER INSERT ON crm_messages
  FOR EACH ROW
  EXECUTE FUNCTION log_message_creation();