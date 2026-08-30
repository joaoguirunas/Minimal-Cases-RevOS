-- get_omni_contacts ganha p_channel — filtro por canal WhatsApp (Meta ou
-- Evolution) atual do contato, mesmo padrão já usado pro p_tag (EXISTS vs
-- coluna direta aqui, já que active_channel_id é coluna direta em
-- clients_people, não precisa de join).

BEGIN;

-- CREATE OR REPLACE não troca a assinatura antiga por conta própria quando o
-- número de parâmetros muda (mesmo só adicionando um opcional no fim) — cria
-- um OVERLOAD novo e deixa os dois coexistindo, o que tornaria toda chamada
-- futura ambígua. Precisa dropar a assinatura de 11 parâmetros explicitamente
-- antes de criar a de 12.
DROP FUNCTION IF EXISTS public.get_omni_contacts(text, text, text, text, text, text, text, text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_omni_contacts(
  p_search_term text DEFAULT NULL::text,
  p_status_atend text DEFAULT NULL::text,
  p_atend_ia text DEFAULT NULL::text,
  p_filtro_data text DEFAULT NULL::text,
  p_responsavel text DEFAULT NULL::text,
  p_pipeline text DEFAULT NULL::text,
  p_etapa text DEFAULT NULL::text,
  p_time text DEFAULT NULL::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_tag text DEFAULT NULL::text,
  p_channel text DEFAULT NULL::text
)
RETURNS TABLE(contact jsonb, total_count bigint)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    to_jsonb(p.*)    AS contact,
    COUNT(*) OVER()  AS total_count
  FROM public.clients_people p
  WHERE
    (
      p.whatsapp               IS NOT NULL
      OR p.instagram_id          IS NOT NULL
      OR p.tiktok_open_id        IS NOT NULL
      OR p.manychat_subscriber_id IS NOT NULL
      OR p.email                 IS NOT NULL
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
    AND (
      p_tag IS NULL OR
      EXISTS (
        SELECT 1 FROM public.leads l
        JOIN public.leads_tags lt ON lt.lead_id = l.id
        WHERE l.people_id = p.id
          AND lt.tag_id = p_tag::uuid
      )
    )
    AND (
      p_channel IS NULL OR p.active_channel_id = p_channel::uuid
    )
  ORDER BY p.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$function$;

-- smoke test: confirma que compilou e aceita o novo param
SELECT count(*) AS ok FROM public.get_omni_contacts(p_limit := 1, p_channel := NULL);

COMMIT;
