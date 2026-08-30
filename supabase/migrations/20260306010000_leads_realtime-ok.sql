-- Enable Supabase Realtime on the leads table
-- Required for the Kanban board to auto-refresh when new leads are created
-- (e.g., by whatsapp-inbound edge function via OMNI New Contact config)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END;
$$;
