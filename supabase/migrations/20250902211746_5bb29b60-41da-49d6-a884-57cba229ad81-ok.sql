-- Add simple indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_messages_pessoa_created 
ON public.crm_messages (pessoa_id, created_at DESC) 
WHERE pessoa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_messages_lead_created
ON public.crm_messages (lead_id, created_at DESC);

-- Create a simple trigger function to prevent exact duplicates
CREATE OR REPLACE FUNCTION public.prevent_exact_message_duplicates()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if an exact duplicate exists (same lead, message, sender, within 2 seconds)
  IF EXISTS (
    SELECT 1 FROM public.crm_messages 
    WHERE lead_id = NEW.lead_id 
    AND message = NEW.message 
    AND from_message = NEW.from_message
    AND ABS(EXTRACT(EPOCH FROM (created_at - NEW.created_at))) < 2
    AND id != COALESCE(NEW.id, 0)
  ) THEN
    -- Log the attempted duplicate but don't fail - just skip it
    RAISE NOTICE 'Duplicate message detected and prevented: lead_id=%, message=%, from=%', 
      NEW.lead_id, LEFT(NEW.message, 50), NEW.from_message;
    RETURN NULL; -- This prevents the insert/update
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to prevent duplicates on insert only (not update to avoid issues)
DROP TRIGGER IF EXISTS prevent_exact_duplicates_trigger ON public.crm_messages;
CREATE TRIGGER prevent_exact_duplicates_trigger
  BEFORE INSERT ON public.crm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_exact_message_duplicates();

-- Create function to clean existing duplicates
CREATE OR REPLACE FUNCTION public.clean_message_duplicates()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete duplicates keeping the earliest one
  WITH duplicate_groups AS (
    SELECT 
      lead_id, 
      message, 
      from_message,
      MIN(id) as keep_id,
      COUNT(*) as duplicate_count
    FROM public.crm_messages 
    GROUP BY lead_id, message, from_message
    HAVING COUNT(*) > 1
  ),
  duplicates_to_delete AS (
    SELECT cm.id
    FROM public.crm_messages cm
    INNER JOIN duplicate_groups dg ON (
      cm.lead_id = dg.lead_id 
      AND cm.message = dg.message 
      AND cm.from_message = dg.from_message
    )
    WHERE cm.id != dg.keep_id
  )
  DELETE FROM public.crm_messages 
  WHERE id IN (SELECT id FROM duplicates_to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned % duplicate messages', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the cleanup
SELECT public.clean_message_duplicates();