-- Step 1: Clean existing duplicates (keep messages with usuario_id, remove NULL ones)
DELETE FROM crm_messages 
WHERE id IN (
  SELECT DISTINCT m2.id
  FROM crm_messages m1
  JOIN crm_messages m2 ON (
    m1.lead_id = m2.lead_id 
    AND m1.message = m2.message 
    AND m1.from_message = m2.from_message
    AND ABS(EXTRACT(EPOCH FROM (m1.created_at - m2.created_at))) < 300 -- 5 minutos
    AND m1.id != m2.id
  )
  WHERE m1.usuario_id IS NOT NULL 
  AND m2.usuario_id IS NULL
);

-- Step 2: Drop existing trigger and function
DROP TRIGGER IF EXISTS prevent_duplicate_messages ON crm_messages;
DROP FUNCTION IF EXISTS prevent_message_duplicates();

-- Step 3: Create improved deduplication function (ignoring usuario_id)
CREATE OR REPLACE FUNCTION prevent_message_duplicates()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for duplicate messages in the last 5 minutes, ignoring usuario_id
  IF EXISTS (
    SELECT 1 FROM crm_messages 
    WHERE lead_id = NEW.lead_id 
    AND message = NEW.message 
    AND from_message = NEW.from_message
    AND tenant_id = NEW.tenant_id
    AND created_at > NOW() - INTERVAL '5 minutes'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Duplicate message detected: lead_id=%, message=%, from_message=%', 
      NEW.lead_id, LEFT(NEW.message, 50), NEW.from_message;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
CREATE TRIGGER prevent_duplicate_messages
  BEFORE INSERT ON crm_messages
  FOR EACH ROW
  EXECUTE FUNCTION prevent_message_duplicates();

-- Step 5: Add index for better performance
CREATE INDEX IF NOT EXISTS idx_crm_messages_dedup 
ON crm_messages (lead_id, tenant_id, created_at, from_message);

-- Step 6: Add logging function for monitoring
CREATE OR REPLACE FUNCTION log_duplicate_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Log any duplicate attempts for monitoring
  INSERT INTO crm_logs (
    tenant_id, 
    tipo, 
    descricao, 
    detalhes,
    created_at
  ) VALUES (
    NEW.tenant_id,
    'duplicate_message_blocked',
    'Duplicate message blocked by trigger',
    jsonb_build_object(
      'lead_id', NEW.lead_id,
      'message_preview', LEFT(NEW.message, 100),
      'from_message', NEW.from_message,
      'usuario_id', NEW.usuario_id
    ),
    NOW()
  );
  
  RETURN NULL; -- Block the insert
END;
$$ LANGUAGE plpgsql;