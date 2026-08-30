-- Allow content column to be nullable in leads_notes
ALTER TABLE public.leads_notes 
ALTER COLUMN content DROP NOT NULL;

-- Also add the missing title column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads_notes' 
    AND column_name = 'title'
  ) THEN
    ALTER TABLE public.leads_notes ADD COLUMN title TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.leads_notes.content IS 'Optional note content/description';