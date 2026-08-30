-- FIX: Add UNIQUE constraint on message_id for upsert to work
-- Bug: delivery engine uses upsert with onConflict: 'message_id' but column had no UNIQUE constraint
-- Epic: EPIC-OMNI-PRO-V2 | Story: OP-04 (bug fix)

-- Drop the non-unique index first (will be replaced by unique constraint's implicit index)
DROP INDEX IF EXISTS idx_dead_letter_message;

-- Add UNIQUE constraint
ALTER TABLE omni_delivery_dead_letter
  ADD CONSTRAINT uq_dead_letter_message_id UNIQUE (message_id);
