-- Add unique constraint to prevent duplicate messages
-- This will prevent the same message content + timestamp from being inserted twice
ALTER TABLE public.crm_messages 
ADD CONSTRAINT unique_message_per_lead_and_time 
UNIQUE (lead_id, message, from_message, DATE_TRUNC('second', created_at));

-- Add index for better performance on message queries
CREATE INDEX IF NOT EXISTS idx_crm_messages_pessoa_created 
ON public.crm_messages (pessoa_id, created_at DESC) 
WHERE pessoa_id IS NOT NULL;

-- Add index for lead-based queries  
CREATE INDEX IF NOT EXISTS idx_crm_messages_lead_created
ON public.crm_messages (lead_id, created_at DESC);

-- Create function to detect and remove duplicates
CREATE OR REPLACE FUNCTION public.remove_duplicate_messages()
RETURNS void AS $$
BEGIN
  -- Remove duplicates keeping the first occurrence (earliest created_at)
  DELETE FROM public.crm_messages 
  WHERE id NOT IN (
    SELECT DISTINCT ON (lead_id, message, from_message, DATE_TRUNC('second', created_at)) id
    FROM public.crm_messages 
    ORDER BY lead_id, message, from_message, DATE_TRUNC('second', created_at), created_at ASC
  );
  
  RAISE NOTICE 'Duplicate messages removed successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean existing duplicates
SELECT public.remove_duplicate_messages();