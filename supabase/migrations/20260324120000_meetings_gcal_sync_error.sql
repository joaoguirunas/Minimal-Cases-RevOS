-- Add gcal_sync_error column to track sync failures visibly
-- NULL = no error (either synced successfully or not attempted)
-- Non-null = reason why gcal_sync failed (e.g. 'token_refresh_failed', 'no_calendar_connection')
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS gcal_sync_error text DEFAULT NULL;
