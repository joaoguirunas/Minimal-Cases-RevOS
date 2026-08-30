-- FIX-SENDS-DUP-01: send-dispatch-worker fetched pending sends_contacts rows with a
-- plain SELECT and only marked them 'sent'/'error' AFTER the real WhatsApp send.
-- Two overlapping invocations (an overlapping cron tick, or a cron tick racing a
-- manual/immediate trigger) could both fetch and both actually send the SAME
-- contact — confirmed in production: one lead received the same template 3x within
-- ~3 seconds. Add 'sending' as a valid status so the worker can atomically claim a
-- row (UPDATE ... WHERE status='pending') before sending; a losing concurrent
-- invocation gets zero rows back for that contact instead of double-sending.
ALTER TABLE sends_contacts DROP CONSTRAINT sends_contacts_status_check;
ALTER TABLE sends_contacts ADD CONSTRAINT sends_contacts_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'error'::text]));
