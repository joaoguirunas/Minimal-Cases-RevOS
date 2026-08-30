-- Allow all authenticated users to SELECT from settings_whatsapp_channels.
-- User type needs to read available channels to auto-select the default one
-- when creating a campaign (CriarDisparo page). Without this, useWhatsappChannels()
-- returns [] for user type, effectiveWaChannelId stays null, and the dispatch
-- worker throws 500 ("Canal WhatsApp não configurado").
CREATE POLICY "wa_channels_authenticated_read"
  ON settings_whatsapp_channels
  FOR SELECT
  TO authenticated
  USING (true);
