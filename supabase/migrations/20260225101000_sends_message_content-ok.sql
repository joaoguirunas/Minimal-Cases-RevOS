-- SENDS PRO™: Add message_content for non-WhatsApp channels
-- Stores the message body sent to N8N for Email/SMS/Phone campaigns

ALTER TABLE public.sends
  ADD COLUMN IF NOT EXISTS message_content TEXT;

COMMENT ON COLUMN public.sends.message_content IS 'Message body for non-WhatsApp channels (Email, SMS, Phone). For WhatsApp, use whatsapp_template_id instead.';
