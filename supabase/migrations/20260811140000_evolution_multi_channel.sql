-- Permite mais de 1 canal Evolution (WhatsApp não-oficial) simultâneo — antes
-- limitado a exatamente 1 por idx_wa_channels_one_evolution. As funções que
-- resolvem canal por id/channel_id (whatsapp-outbound, send-dispatch-worker)
-- já eram genéricas e não precisam de mudança; só o auth do webhook e o
-- gerenciamento de sessão assumiam singularidade — corrigidos junto (código).

BEGIN;

DROP INDEX IF EXISTS idx_wa_channels_one_evolution;

-- evolution_webhook_token vira chave de lookup do auth do webhook (cada canal
-- tem o seu, gerado no setup) — precisa ser único pra resolução não ficar ambígua.
CREATE UNIQUE INDEX idx_wa_channels_evolution_token_unique
  ON public.settings_whatsapp_channels (evolution_webhook_token)
  WHERE provider = 'evolution';

-- Evita registrar o mesmo servidor+instância duas vezes por engano — substitui
-- a regra antiga (max 1 no total) por uma mais correta (max 1 por servidor+instância).
CREATE UNIQUE INDEX idx_wa_channels_evolution_server_instance_unique
  ON public.settings_whatsapp_channels (evolution_base_url, evolution_instance_name)
  WHERE provider = 'evolution';

COMMENT ON COLUMN public.settings_whatsapp_channels.provider IS
  'meta = Cloud API oficial (existente). evolution = Evolution API self-hosted (Baileys), tenant-wide, sem template/janela 24h. Múltiplos canais evolution podem coexistir (cada um = um número/servidor distinto).';

-- smoke test
SELECT
  (SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_wa_channels_one_evolution') AS old_index_gone,
  (SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_wa_channels_evolution_token_unique') AS token_index_ok,
  (SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_wa_channels_evolution_server_instance_unique') AS server_instance_index_ok;

COMMIT;
