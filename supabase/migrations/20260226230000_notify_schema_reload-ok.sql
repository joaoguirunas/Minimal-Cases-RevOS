-- Reload PostgREST schema cache to pick up:
--   get_booking_session(uuid, uuid, integer, integer)
--   get_booking_eligible_user_ids(uuid)
-- Added in migration 20260226220000

SELECT pg_notify('pgrst', 'reload schema');
