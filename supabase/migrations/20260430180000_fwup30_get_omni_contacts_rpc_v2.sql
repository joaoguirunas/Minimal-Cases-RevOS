-- fwup30: get_omni_contacts v2 — fixes for ORA empty inbox and TikTok contacts
--
-- Changes vs fwup28:
--   1. Canal filter now includes tiktok_open_id (contacts without WA or IG but with TikTok)
--   2. service_status filter for 'open' now also matches NULL (contacts that predate
--      the p10 normalization migration and were never explicitly set to 'open')

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
    -- canal: whatsapp, instagram, or tiktok obrigatório
    (p.whatsapp IS NOT NULL OR p.instagram_id IS NOT NULL OR p.tiktok_open_id IS NOT NULL)
    AND p.status <> 'merged'
    -- busca
    AND (
      p_search_term IS NULL OR p_search_term = '' OR
      p.name              ILIKE '%' || p_search_term || '%' OR
      p.whatsapp          ILIKE '%' || p_search_term || '%' OR
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
