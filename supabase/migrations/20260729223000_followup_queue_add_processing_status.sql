BEGIN;

ALTER TABLE followup_queue DROP CONSTRAINT followup_queue_status_check;
ALTER TABLE followup_queue ADD CONSTRAINT followup_queue_status_check
  CHECK (status = ANY (ARRAY['pending','processing','queued','sent','failed','cancelled']));

-- smoke test
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'followup_queue'::regclass AND conname = 'followup_queue_status_check';

COMMIT;
