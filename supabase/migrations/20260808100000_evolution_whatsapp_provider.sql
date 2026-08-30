-- Suporte a WhatsApp não-oficial via Evolution API (self-hosted, engine Baileys).
-- Referência: implementação do Ora (/Volumes/nvme/ora/ora), adaptada de per-user
-- pra tenant-wide — sem owner_user_id, sem "Meu WhatsApp Pessoal": conecta uma vez
-- em Integrações e o CRM inteiro passa a ter acesso, igual já funciona pra Meta.
--
-- settings_whatsapp_channels ganha uma 2ª forma de canal (provider='evolution')
-- coexistindo com os canais Meta já existentes — SEM switch exclusivo. Cada
-- canal já é resolvido individualmente por channel_id/canal-da-última-inbound/
-- default hoje; evolution entra nesse mesmo pool.

BEGIN;

-- ── 1. settings_whatsapp_channels: provider + campos evolution_* ────────────

ALTER TABLE public.settings_whatsapp_channels
  ALTER COLUMN phone_number_id DROP NOT NULL,
  ALTER COLUMN access_token DROP NOT NULL;

ALTER TABLE public.settings_whatsapp_channels
  ADD COLUMN provider text NOT NULL DEFAULT 'meta',
  ADD COLUMN evolution_base_url text,
  ADD COLUMN evolution_api_key text,
  ADD COLUMN evolution_webhook_token text,
  ADD COLUMN evolution_instance_name text,
  ADD COLUMN evolution_status text,
  ADD COLUMN evolution_last_seen_at timestamptz;

ALTER TABLE public.settings_whatsapp_channels
  ADD CONSTRAINT settings_whatsapp_channels_provider_check
    CHECK (provider IN ('meta', 'evolution'));

ALTER TABLE public.settings_whatsapp_channels
  ADD CONSTRAINT settings_whatsapp_channels_evolution_status_check
    CHECK (evolution_status IS NULL OR evolution_status IN ('STOPPED', 'STARTING', 'SCAN_QR_CODE', 'WORKING', 'FAILED', 'BANNED'));

-- Cada provider exige seus próprios campos obrigatórios — vocabulário canônico
-- de status (STOPPED/STARTING/SCAN_QR_CODE/WORKING/FAILED/BANNED) é o mesmo do
-- Ora, pra reaproveitar a tradução open/connecting/close → canônico do client.
ALTER TABLE public.settings_whatsapp_channels
  ADD CONSTRAINT settings_whatsapp_channels_provider_fields_check
    CHECK (
      (provider = 'meta' AND phone_number_id IS NOT NULL AND access_token IS NOT NULL)
      OR (provider = 'evolution' AND evolution_base_url IS NOT NULL AND evolution_api_key IS NOT NULL
          AND evolution_webhook_token IS NOT NULL AND evolution_instance_name IS NOT NULL)
    );

COMMENT ON COLUMN public.settings_whatsapp_channels.provider IS
  'meta = Cloud API oficial (existente). evolution = Evolution API self-hosted (Baileys), tenant-wide, sem template/janela 24h. No máx 1 canal evolution (idx_wa_channels_one_evolution).';
COMMENT ON COLUMN public.settings_whatsapp_channels.evolution_api_key IS
  'Cleartext — mesmo débito já aceito pra access_token do Meta nesta tabela. Rotacionar via UI se exposto.';

-- No máximo 1 canal Evolution (integração tenant-wide, não multi-instância).
CREATE UNIQUE INDEX idx_wa_channels_one_evolution
  ON public.settings_whatsapp_channels (provider)
  WHERE provider = 'evolution';

-- ── 2. whatsapp_templates: provider (evolution = texto livre, sem aprovação) ──

ALTER TABLE public.whatsapp_templates
  ADD COLUMN provider text NOT NULL DEFAULT 'meta';

ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_provider_check CHECK (provider IN ('meta', 'evolution'));

-- ── 3. clients_people: auto-pause de IA quando humano responde manualmente ───
-- Canal-agnóstico de propósito (Meta, Evolution, Instagram, o que for) — não é
-- específico da integração Evolution, é um comportamento geral que faltava.

ALTER TABLE public.clients_people
  ADD COLUMN ai_paused_reason text,
  ADD COLUMN ai_paused_at timestamptz;

COMMENT ON COLUMN public.clients_people.ai_paused_reason IS
  'Motivo do último auto-pause da IA (ex: human_reply). NULL = nunca pausado automaticamente ou já reativado. Distinto de ai_enabled=false manual: aqui o sistema decidiu, não o admin.';

CREATE OR REPLACE FUNCTION public.auto_pause_ai_on_human_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- from_contact != 'cliente' e source_type='manual' é a assinatura exata de
  -- "um atendente digitou e enviou isso agora, no Omni" — automações (campaign,
  -- followup, appointment_reminder, kiwify) e a própria IA (ai_agent) não pausam.
  IF NEW.from_contact <> 'cliente' AND NEW.source_type = 'manual' THEN
    UPDATE public.clients_people
       SET ai_enabled = false,
           ai_paused_reason = 'human_reply',
           ai_paused_at = now()
     WHERE id = NEW.people_id
       AND ai_enabled = true;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- nunca pode derrubar o envio da mensagem em si
END;
$function$;

COMMENT ON FUNCTION public.auto_pause_ai_on_human_message IS
  'AFTER INSERT em messages: quando um atendente responde manualmente (source_type=manual, from_contact != cliente), desliga ai_enabled pra esse contato — evita a IA responder por cima de quem já está atendendo. Reativação é manual (UI seta ai_enabled=true de volta, o que também deveria limpar ai_paused_reason).';

CREATE TRIGGER trg_auto_pause_ai_on_human_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_pause_ai_on_human_message();

-- smoke test: confirma que compilou
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='settings_whatsapp_channels' AND column_name='provider') AS provider_col_ok,
  (SELECT count(*) FROM pg_trigger WHERE tgname='trg_auto_pause_ai_on_human_message') AS trigger_ok,
  (SELECT count(*) FROM pg_indexes WHERE indexname='idx_wa_channels_one_evolution') AS index_ok;

COMMIT;
