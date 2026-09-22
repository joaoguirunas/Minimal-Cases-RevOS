-- OMNI-02 — Lista de conversas: não lidas em primeiro + filtros de triagem.
--
-- Ordem: fila humana (quem pediu atendimento) → conversas com mensagem não lida
-- → atividade recente. Antes, uma conversa com cliente esperando ficava abaixo
-- de outra em que o próprio time acabara de escrever.
--
-- Dois filtros novos, independentes e combináveis:
--   p_apenas_nao_lidas  — só conversas com mensagem não lida;
--   p_ultima_do_cliente — só conversas em que o cliente mandou a última
--                         mensagem (last_message_from, mantido por gatilho).
--
-- Correção: o status "Pendente" (p_status_atend = 'nao_respondida') procurava
-- service_status = 'nao_respondida', valor que nenhum contato tem — o filtro
-- sempre voltava vazio. "Não respondida" é exatamente "o cliente falou por
-- último", então passa a usar a mesma regra.
--
-- Parâmetros novos têm default: chamadas antigas continuam funcionando.

DROP FUNCTION IF EXISTS public.get_omni_contacts(text, text, text, text, text, text, text, text, integer, integer, text, text);

CREATE FUNCTION public.get_omni_contacts(
  p_search_term text DEFAULT NULL::text, p_status_atend text DEFAULT NULL::text, p_atend_ia text DEFAULT NULL::text,
  p_filtro_data text DEFAULT NULL::text, p_responsavel text DEFAULT NULL::text, p_pipeline text DEFAULT NULL::text,
  p_etapa text DEFAULT NULL::text, p_time text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0,
  p_tag text DEFAULT NULL::text, p_channel text DEFAULT NULL::text,
  p_apenas_nao_lidas boolean DEFAULT false, p_ultima_do_cliente boolean DEFAULT false)
 RETURNS TABLE(contact jsonb, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
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
      OR (p_status_atend = 'open'           AND (p.service_status = 'open' OR p.service_status IS NULL))
      OR (p_status_atend = 'nao_respondida' AND p.last_message_from = 'cliente'
                                            AND (p.service_status = 'open' OR p.service_status IS NULL))
      OR (p_status_atend NOT IN ('open','nao_respondida') AND p.service_status = p_status_atend)
    )
    AND (NOT p_apenas_nao_lidas  OR COALESCE(p.unread_count, 0) > 0)
    AND (NOT p_ultima_do_cliente OR p.last_message_from = 'cliente')
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
    AND (p_pipeline IS NULL OR EXISTS (
        SELECT 1 FROM public.leads l WHERE l.people_id = p.id AND l.leads_pipelines_id = p_pipeline::uuid))
    AND (p_etapa IS NULL OR EXISTS (
        SELECT 1 FROM public.leads l WHERE l.people_id = p.id AND l.leads_stages_id = p_etapa::uuid))
    AND (p_time IS NULL OR EXISTS (
        SELECT 1 FROM public.leads l WHERE l.people_id = p.id AND l.teams_id = p_time::uuid))
    AND (p_tag IS NULL OR EXISTS (
        SELECT 1 FROM public.leads l JOIN public.leads_tags lt ON lt.lead_id = l.id
        WHERE l.people_id = p.id AND lt.tag_id = p_tag::uuid))
    AND (p_channel IS NULL OR p.active_channel_id = p_channel::uuid)
  ORDER BY
    (p.needs_human_at IS NULL),              -- 1º quem está na fila humana
    p.needs_human_at ASC,                    --    (quem espera há mais tempo no topo)
    (COALESCE(p.unread_count, 0) = 0),       -- 2º quem tem mensagem não lida
    p.updated_at DESC                        -- 3º atividade recente
  LIMIT  p_limit
  OFFSET p_offset;
$function$;

-- Mesmas permissões da versão anterior: só usuário autenticado do app.
REVOKE EXECUTE ON FUNCTION public.get_omni_contacts(text, text, text, text, text, text, text, text, integer, integer, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_omni_contacts(text, text, text, text, text, text, text, text, integer, integer, text, text, boolean, boolean) TO authenticated, service_role;
