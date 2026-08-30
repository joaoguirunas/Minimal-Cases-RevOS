-- Cleanup: remove all meetings (test data + old google-synced events)
-- After this, google-cal-sync-to-db will re-populate from Google Calendar
-- and new meetings created via app will start fresh.

TRUNCATE TABLE meetings RESTART IDENTITY CASCADE;
