-- fwup27: colunas ausentes em clients_people para tenants criados a partir do baseline
-- O baseline (20260312) criou clients_people sem estas colunas que as migrations
-- pré-epoch (jan-mar/2026) adicionavam mas não estavam em client-migrations.json.
-- Todas idempotentes (IF NOT EXISTS).

-- instagram_id — dedup Omni + filtro useConversasSimples (query falha sem ela)
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS instagram_id text;
CREATE UNIQUE INDEX IF NOT EXISTS clients_people_instagram_id_key
  ON public.clients_people (instagram_id) WHERE instagram_id IS NOT NULL;

-- instagram_user_id — DM Instagram + busca no Omni
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS instagram_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_people_instagram_user_id
  ON public.clients_people (instagram_user_id) WHERE instagram_user_id IS NOT NULL;

-- instagram_handle — unificação de identidade
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS instagram_handle text;

-- merged_into_id + merge_history — deduplicação de contatos
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.clients_people(id),
  ADD COLUMN IF NOT EXISTS merge_history  jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_clients_people_merged_into_id
  ON public.clients_people (merged_into_id) WHERE merged_into_id IS NOT NULL;

-- telefone — canal de voz (CallPro)
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS telefone text;
CREATE INDEX IF NOT EXISTS idx_clients_people_telefone_not_null
  ON public.clients_people (telefone) WHERE telefone IS NOT NULL;

-- ai_last_message_at + ai_processing_lock — controle do buffer de IA
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS ai_last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_processing_lock boolean NOT NULL DEFAULT false;

-- tiktok_open_id — canal TikTok
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS tiktok_open_id text;
CREATE INDEX IF NOT EXISTS idx_clients_people_tiktok_open_id
  ON public.clients_people (tiktok_open_id) WHERE tiktok_open_id IS NOT NULL;
