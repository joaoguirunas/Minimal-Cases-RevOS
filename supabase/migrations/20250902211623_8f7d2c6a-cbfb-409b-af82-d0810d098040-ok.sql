-- First, let's clean existing duplicates to prepare for the constraint
WITH duplicate_groups AS (
  SELECT 
    lead_id, 
    message, 
    from_message,
    DATE_TRUNC('second', created_at) as rounded_time,
    MIN(id) as keep_id
  FROM public.crm_messages 
  GROUP BY lead_id, message, from_message, DATE_TRUNC('second', created_at)
  HAVING COUNT(*) > 1
),
duplicates_to_delete AS (
  SELECT cm.id
  FROM public.crm_messages cm
  INNER JOIN duplicate_groups dg ON (
    cm.lead_id = dg.lead_id 
    AND cm.message = dg.message 
    AND cm.from_message = dg.from_message
    AND DATE_TRUNC('second', cm.created_at) = dg.rounded_time
  )
  WHERE cm.id != dg.keep_id
)
DELETE FROM public.crm_messages 
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Add index for better performance on message queries
CREATE INDEX IF NOT EXISTS idx_crm_messages_pessoa_created 
ON public.crm_messages (pessoa_id, created_at DESC) 
WHERE pessoa_id IS NOT NULL;

-- Add index for lead-based queries  
CREATE INDEX IF NOT EXISTS idx_crm_messages_lead_created
ON public.crm_messages (lead_id, created_at DESC);

-- Add partial unique index to prevent duplicates (this works better than a constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_messages_unique_content
ON public.crm_messages (lead_id, message, from_message, DATE_TRUNC('second', created_at))
WHERE message IS NOT NULL AND from_message IS NOT NULL;

-- Create function to detect and remove future duplicates
CREATE OR REPLACE FUNCTION public.prevent_message_duplicates()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if a similar message already exists within the same second
  IF EXISTS (
    SELECT 1 FROM public.crm_messages 
    WHERE lead_id = NEW.lead_id 
    AND message = NEW.message 
    AND from_message = NEW.from_message
    AND DATE_TRUNC('second', created_at) = DATE_TRUNC('second', NEW.created_at)
    AND id != COALESCE(NEW.id, 0)
  ) THEN
    RAISE EXCEPTION 'Duplicate message detected: same content and sender within the same second';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to prevent duplicates on insert/update
DROP TRIGGER IF EXISTS prevent_message_duplicates_trigger ON public.crm_messages;
CREATE TRIGGER prevent_message_duplicates_trigger
  BEFORE INSERT OR UPDATE ON public.crm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_duplicates();