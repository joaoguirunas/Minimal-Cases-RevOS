-- SAC-01 — Fila de atendimento humano.
--
-- O agente já sabia pedir socorro (bloquear_ia desliga a IA e registra o motivo),
-- mas o pedido não chegava a lugar nenhum: a lista de conversas ordena por
-- atividade recente e não existe conceito de prioridade. Quem pediu cancelamento
-- ou reembolso ficava no meio da lista, indistinguível de quem mandou "oi".
--
-- Aqui entram as duas peças que faltavam: uma marca de "aguardando humano" na
-- pessoa e a lista passando a ordenar por ela antes da data. Fila FIFO entre os
-- marcados — quem espera há mais tempo fica no topo.

-- ── 0. Tipo do alerta ───────────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação que o cria,
-- por isso vem antes de tudo e sozinho.
ALTER TYPE public.notification_event_type ADD VALUE IF NOT EXISTS 'handoff_humano';

-- ── 1. A marca ──────────────────────────────────────────────────────────────
ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS needs_human_at     timestamptz,
  ADD COLUMN IF NOT EXISTS needs_human_reason text;

COMMENT ON COLUMN public.clients_people.needs_human_at IS
  'Quando o contato entrou na fila de atendimento humano (handoff do agente). NULL = não está na fila. Ordena a lista de conversas: marcados primeiro, mais antigo no topo.';

CREATE INDEX IF NOT EXISTS idx_clients_people_needs_human
  ON public.clients_people (needs_human_at)
  WHERE needs_human_at IS NOT NULL;

-- ── 2. Entrar na fila: marca + sino, numa transação só ──────────────────────
-- O índice único de notifications é parcial ((people_id, event_type) WHERE
-- read_at IS NULL), o que o PostgREST não consegue mirar num ON CONFLICT. Por
-- isso o upsert mora aqui: um handoff repetido atualiza o alerta aberto em vez
-- de empilhar sinos para a mesma pessoa.
CREATE OR REPLACE FUNCTION public.flag_needs_human(
  p_people_id uuid,
  p_lead_id   uuid    DEFAULT NULL,
  p_reason    text    DEFAULT NULL,
  p_title     text    DEFAULT 'Cliente aguardando atendimento humano'
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF p_people_id IS NULL THEN RETURN; END IF;

  -- Só marca quem ainda não está na fila: reentrar não pode furar a ordem de
  -- quem já estava esperando.
  UPDATE public.clients_people
  SET needs_human_at     = COALESCE(needs_human_at, now()),
      needs_human_reason = COALESCE(p_reason, needs_human_reason)
  WHERE id = p_people_id;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.notifications
  SET title = p_title,
      body  = COALESCE(p_reason, body),
      created_at = now()
  WHERE people_id = p_people_id AND event_type = 'handoff_humano' AND read_at IS NULL;

  IF NOT FOUND THEN
    INSERT INTO public.notifications (event_type, people_id, lead_id, title, body, channel)
    VALUES ('handoff_humano', p_people_id, p_lead_id, p_title,
            COALESCE(p_reason, 'O agente passou a conversa para o time.'), 'whatsapp');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.flag_needs_human(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.flag_needs_human(uuid, uuid, text, text) TO service_role;

-- ── 3. Sair da fila ─────────────────────────────────────────────────────────
-- Humano assumiu (religou a IA) ou fechou o atendimento → sai da fila e o sino
-- aberto é dado como lido. Sem isso a fila só cresce.
CREATE OR REPLACE FUNCTION public.clear_needs_human_on_takeover()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.needs_human_at IS NULL THEN RETURN NEW; END IF;

  IF (NEW.ai_enabled IS TRUE AND OLD.ai_enabled IS NOT TRUE)
     OR (NEW.service_status = 'closed' AND OLD.service_status IS DISTINCT FROM 'closed') THEN
    NEW.needs_human_at     := NULL;
    NEW.needs_human_reason := NULL;
    UPDATE public.notifications
    SET read_at = now()
    WHERE people_id = NEW.id AND event_type = 'handoff_humano' AND read_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_needs_human ON public.clients_people;
CREATE TRIGGER trg_clear_needs_human
  BEFORE UPDATE ON public.clients_people
  FOR EACH ROW
  WHEN (OLD.needs_human_at IS NOT NULL)
  EXECUTE FUNCTION public.clear_needs_human_on_takeover();

-- ── 4. A lista de conversas respeita a fila ─────────────────────────────────
-- Única mudança: o ORDER BY. Os filtros e o shape do retorno seguem idênticos.
CREATE OR REPLACE FUNCTION public.get_omni_contacts(p_search_term text DEFAULT NULL::text, p_status_atend text DEFAULT NULL::text, p_atend_ia text DEFAULT NULL::text, p_filtro_data text DEFAULT NULL::text, p_responsavel text DEFAULT NULL::text, p_pipeline text DEFAULT NULL::text, p_etapa text DEFAULT NULL::text, p_time text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_tag text DEFAULT NULL::text, p_channel text DEFAULT NULL::text)
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
  ORDER BY
    (p.needs_human_at IS NULL),   -- false (na fila) antes de true
    p.needs_human_at ASC,          -- entre os da fila, quem espera há mais tempo
    p.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$function$;
