-- ManyChat TikTok DM integration — channel `tiktok-manychat`
--
-- ManyChat acts as middleware for TikTok DMs (distinct from the native `tiktok`
-- channel which uses tiktok_open_id). Contacts are keyed by ManyChat's
-- subscriber_id (bigint, stable per page).
--
-- This migration:
--   1. Adds clients_people.manychat_subscriber_id (bigint) + partial unique index
--   2. Widens messages_channel_check to allow 'tiktok-manychat'
--   3. Widens omni_channel_alerts_channel_check to allow 'tiktok-manychat'
--   4. Widens omni_channel_configs_channel_check to allow 'tiktok-manychat'
--      (REQUIRED — the live constraint restricts channel; without this the
--       config INSERT in step 6 would violate the CHECK)
--   5. Updates get_omni_contacts: contact is eligible when
--      manychat_subscriber_id IS NOT NULL (the new column is already returned
--      via to_jsonb(p.*), so only the WHERE clause changes)
--   6. Seeds an inactive omni_channel_configs row for the panel to discover the
--      channel (credentials filled later via UI)
--
-- Live-verified state (2026-06-29, project wotuyxscsfralqpoiyfv):
--   messages_channel_check          = whatsapp,instagram,email,sms,telefone,tiktok
--   omni_channel_alerts_channel_check = whatsapp,instagram,email,sms,telefone,system
--   omni_channel_configs_channel_check = whatsapp,instagram,email,sms,telefone,identity_collection,tldv,tiktok
--   omni_channel_configs.display_name is NOT NULL (no default) — must be provided

BEGIN;

-- ── 1. clients_people — ManyChat identity columns ────────────────────────────
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS manychat_subscriber_id bigint,
  ADD COLUMN IF NOT EXISTS tiktok_username        text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_people_manychat_subscriber_id
  ON public.clients_people (manychat_subscriber_id)
  WHERE manychat_subscriber_id IS NOT NULL;

-- ── 2. messages_channel_check ────────────────────────────────────────────────
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_channel_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone',
    'tiktok', 'tiktok-manychat'
  ]));

-- ── 3. omni_channel_alerts_channel_check ─────────────────────────────────────
ALTER TABLE public.omni_channel_alerts
  DROP CONSTRAINT IF EXISTS omni_channel_alerts_channel_check;

ALTER TABLE public.omni_channel_alerts
  ADD CONSTRAINT omni_channel_alerts_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone',
    'system', 'tiktok-manychat'
  ]));

-- ── 4. omni_channel_configs_channel_check ────────────────────────────────────
ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;

ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone',
    'identity_collection', 'tldv', 'tiktok', 'tiktok-manychat'
  ]));

-- ── 5. get_omni_contacts — include ManyChat contacts ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_omni_contacts(
  p_search_term  text DEFAULT NULL,
  p_status_atend text DEFAULT NULL,
  p_atend_ia     text DEFAULT NULL,
  p_filtro_data  text DEFAULT NULL,   -- formato: 'YYYY-MM-DD_YYYY-MM-DD'
  p_responsavel  text DEFAULT NULL,   -- UUID do usuário
  p_pipeline     text DEFAULT NULL,   -- UUID do pipeline
  p_etapa        text DEFAULT NULL,   -- UUID da etapa
  p_time         text DEFAULT NULL,   -- UUID do time
  p_limit        int  DEFAULT 20,
  p_offset       int  DEFAULT 0
)
RETURNS TABLE (contact jsonb, total_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    to_jsonb(p.*)    AS contact,
    COUNT(*) OVER()  AS total_count
  FROM public.clients_people p
  WHERE
    -- canal: whatsapp, instagram, tiktok, tiktok-manychat, or email obrigatório
    (
      p.whatsapp               IS NOT NULL
      OR p.instagram_id          IS NOT NULL
      OR p.tiktok_open_id        IS NOT NULL
      OR p.manychat_subscriber_id IS NOT NULL
      OR p.email                 IS NOT NULL
    )
    AND p.status <> 'merged'
    -- busca
    AND (
      p_search_term IS NULL OR p_search_term = '' OR
      p.name              ILIKE '%' || p_search_term || '%' OR
      p.whatsapp          ILIKE '%' || p_search_term || '%' OR
      p.email             ILIKE '%' || p_search_term || '%' OR
      p.instagram_user_id ILIKE '%' || p_search_term || '%'
    )
    -- status de atendimento
    -- NULL service_status is treated as 'open' (contacts predating p10 migration)
    AND (
      p_status_atend IS NULL
      OR (p_status_atend = 'open'   AND (p.service_status = 'open'   OR p.service_status IS NULL))
      OR (p_status_atend <> 'open'  AND p.service_status = p_status_atend)
    )
    -- atendimento IA
    AND (
      p_atend_ia IS NULL OR
      (p_atend_ia = 'ia_ativa' AND p.ai_enabled = true) OR
      (p_atend_ia = 'humano'   AND p.ai_enabled = false)
    )
    -- intervalo de data
    AND (
      p_filtro_data IS NULL OR
      p.updated_at BETWEEN
        (split_part(p_filtro_data, '_', 1) || 'T00:00:00')::timestamptz
        AND (split_part(p_filtro_data, '_', 2) || 'T23:59:59')::timestamptz
    )
    -- responsavel: sem lead ativo → aparece; com lead → filtra por user_id
    AND (
      p_responsavel IS NULL
      OR NOT EXISTS (
           SELECT 1 FROM public.leads l
           WHERE l.people_id = p.id
             AND l.status NOT IN ('lost', 'archived')
         )
      OR EXISTS (
           SELECT 1 FROM public.leads l
           WHERE l.people_id = p.id
             AND (l.user_id = p_responsavel::uuid OR l.user_id IS NULL)
         )
    )
    -- pipeline
    AND (
      p_pipeline IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_pipelines_id = p_pipeline::uuid
      )
    )
    -- etapa
    AND (
      p_etapa IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_stages_id = p_etapa::uuid
      )
    )
    -- time
    AND (
      p_time IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.teams_id = p_time::uuid
      )
    )
  ORDER BY p.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_omni_contacts(text,text,text,text,text,text,text,text,int,int) TO authenticated;

-- ── 6. Seed omni_channel_configs row ─────────────────────────────────────────
INSERT INTO public.omni_channel_configs (channel, display_name, credentials, is_active, webhook_fallback)
VALUES (
  'tiktok-manychat',
  'TikTok (ManyChat)',
  '{"api_key": "", "webhook_secret": ""}',
  false,
  NULL
)
ON CONFLICT (channel) DO NOTHING;

COMMIT;
