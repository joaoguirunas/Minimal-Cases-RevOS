-- WA-IMG — templates WhatsApp com header de imagem.
BEGIN;
ALTER TABLE public.settings_whatsapp_channels ADD COLUMN IF NOT EXISTS app_id text;
COMMENT ON COLUMN public.settings_whatsapp_channels.app_id IS 'Meta App ID do app dono do access_token — exigido pela Resumable Upload API (header de imagem em templates). Fallback: secret META_APP_ID.';
COMMENT ON COLUMN public.leads_stages_followups.vars IS
  'Vars estáticas da regra. E-mail/SMS: cupom, cupom_pct, expira_horas. WhatsApp: wa_params (array de nomes de var por {{n}} do corpo: nome|remetente|produto|modelo_celular|preco|cupom|expira_em), wa_button_url (bool: botão URL com token do link rastreado), wa_header_mode (sku|fixa), wa_header_image (URL pública, modo fixa/fallback).';
COMMIT;
