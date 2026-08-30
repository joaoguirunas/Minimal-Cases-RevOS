-- Remove ai_blocked and ai_blocked_until columns from leads table
ALTER TABLE leads DROP COLUMN IF EXISTS ai_blocked;
ALTER TABLE leads DROP COLUMN IF EXISTS ai_blocked_until;