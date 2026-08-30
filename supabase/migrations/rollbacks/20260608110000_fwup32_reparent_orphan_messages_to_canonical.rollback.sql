-- Rollback for: 20260608110000_fwup32_reparent_orphan_messages_to_canonical.sql
-- Tested-against: pg15
--
-- WARNING: This rollback is intentionally a no-op.
--
-- The forward migration performs a data-only UPDATE that moves orphan
-- messages from merged person rows to their canonical merged_into_id.
-- Once messages are re-parented, there is no deterministic way to map
-- them back to the specific merged source person (multiple merged rows
-- can share the same canonical), and re-introducing the orphaned state
-- would only re-create the bug. We therefore leave the data on its
-- canonical owner.
--
-- If you truly need to undo a specific run, restore from backup.

BEGIN;

-- no-op

COMMIT;
