-- SP-10: Add retry_count to sends_contacts for webhook retry tracking
ALTER TABLE sends_contacts
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN sends_contacts.retry_count IS 'Number of webhook dispatch retry attempts (0 = first try, max 3)';
