-- Companion to FIX-SENDS-DUP-01: tracks when a sends_contacts row was claimed
-- (status flipped to 'sending') so a worker crash/timeout mid-send doesn't leave
-- the row stuck forever — send-dispatch-worker treats a 'sending' row whose
-- claimed_at is older than 5 minutes as abandoned and safe to re-claim.
ALTER TABLE sends_contacts ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone;
