-- Rollback for 20260629000000_manychat_tiktok_integration
--
-- Restores the three channel CHECK constraints to their pre-migration state,
-- removes the seeded config row, drops the index and column.
-- NOTE: dropping manychat_subscriber_id is destructive if data was written.
-- Verify no rows use channel='tiktok-manychat' before running.

BEGIN;

DELETE FROM public.omni_channel_configs WHERE channel = 'tiktok-manychat';

-- get_omni_contacts: revert to fwup31 canal filter (no manychat clause)
CREATE OR REPLACE FUNCTION public.get_omni_contacts(
  p_search_term  text DEFAULT NULL,
  p_status_atend text DEFAULT NULL,
  p_atend_ia     text DEFAULT NULL,
  p_filtro_data  text DEFAULT NULL,
  p_responsavel  text DEFAULT NULL,
  p_pipeline     text DEFAULT NULL,
  p_etapa        text DEFAULT NULL,
  p_time         text DEFAULT NULL,
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
    (
      p.whatsapp        IS NOT NULL
      OR p.instagram_id  IS NOT NULL
      OR p.tiktok_open_id IS NOT NULL
      OR p.email         IS NOT NULL
    )
    AND p.status <> 'merged'
    AND (
      p_search_term IS NULL OR p_search_term = '' OR
      p.name              ILIKE '%' || p_search_term || '%' OR
      p.whatsapp          ILIKE '%' || p_search_term || '%' OR
      p.email             ILIKE '%' || p_search_term || '%' OR
      p.instagram_user_id ILIKE '%' || p_search_term || '%'
    )
    AND (
      p_status_atend IS NULL
      OR (p_status_atend = 'open'   AND (p.service_status = 'open'   OR p.service_status IS NULL))
      OR (p_status_atend <> 'open'  AND p.service_status = p_status_atend)
    )
    AND (
      p_atend_ia IS NULL OR
      (p_atend_ia = 'ia_ativa' AND p.ai_enabled = true) OR
      (p_atend_ia = 'humano'   AND p.ai_enabled = false)
    )
    AND (
      p_filtro_data IS NULL OR
      p.updated_at BETWEEN
        (split_part(p_filtro_data, '_', 1) || 'T00:00:00')::timestamptz
        AND (split_part(p_filtro_data, '_', 2) || 'T23:59:59')::timestamptz
    )
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
    AND (
      p_pipeline IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_pipelines_id = p_pipeline::uuid
      )
    )
    AND (
      p_etapa IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.people_id = p.id
          AND l.leads_stages_id = p_etapa::uuid
      )
    )
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

ALTER TABLE public.omni_channel_configs
  DROP CONSTRAINT IF EXISTS omni_channel_configs_channel_check;
ALTER TABLE public.omni_channel_configs
  ADD CONSTRAINT omni_channel_configs_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone',
    'identity_collection', 'tldv', 'tiktok'
  ]));

ALTER TABLE public.omni_channel_alerts
  DROP CONSTRAINT IF EXISTS omni_channel_alerts_channel_check;
ALTER TABLE public.omni_channel_alerts
  ADD CONSTRAINT omni_channel_alerts_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone', 'system'
  ]));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel = ANY (ARRAY[
    'whatsapp', 'instagram', 'email', 'sms', 'telefone', 'tiktok'
  ]));

DROP INDEX IF EXISTS public.idx_clients_people_manychat_subscriber_id;
ALTER TABLE public.clients_people
  DROP COLUMN IF EXISTS manychat_subscriber_id,
  DROP COLUMN IF EXISTS tiktok_username;

COMMIT;
