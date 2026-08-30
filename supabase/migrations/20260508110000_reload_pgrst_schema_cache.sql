-- Trigger PostgREST schema cache reload.
-- Context: PGRST204 on leads_stages_followups.as_queue_id despite FWUP-08 being applied.
-- The column exists in Postgres but PostgREST's in-memory cache is stale.
NOTIFY pgrst, 'reload schema';
