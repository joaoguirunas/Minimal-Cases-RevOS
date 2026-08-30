-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: meeting_followup_queue.webhook_url must be nullable
-- Since template support (20260317400001), rules can have only whatsapp_template_id
-- without a webhook_url. The NOT NULL constraint blocks these inserts.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.meeting_followup_queue ALTER COLUMN webhook_url DROP NOT NULL;
