-- Add whatsapp_provider column to settings table
ALTER TABLE public.settings 
ADD COLUMN whatsapp_provider text NOT NULL DEFAULT 'whatsapp-oficial';

COMMENT ON COLUMN public.settings.whatsapp_provider IS 'WhatsApp provider type: whatsapp-oficial or outro';