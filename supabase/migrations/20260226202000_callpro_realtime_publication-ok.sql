-- Fix: Add call_pro_calls to Supabase Realtime publication
-- The table was created in 20260223000000 but never added to supabase_realtime,
-- so postgres_changes subscriptions (useCallProRealtime) never fire.
-- Also enable REPLICA IDENTITY FULL so UPDATE events include all columns
-- (required for filter `user_id=eq.{id}` to match on UPDATE/DELETE events).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'call_pro_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_pro_calls;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: ensures all column values are included in the WAL
-- record for UPDATE/DELETE events, which is required for column-based filters
-- (e.g., filter: `user_id=eq.{uuid}`) in Supabase Realtime postgres_changes.
ALTER TABLE public.call_pro_calls REPLICA IDENTITY FULL;
