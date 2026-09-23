-- Omni: conversa de uma pessoa em UMA consulta, paginada por cursor.
--
-- Antes o front fazia até 11 idas ao banco em sequência (cadeia de merge,
-- leads, mensagens) e baixava a conversa inteira (limite 50 mil) com select *
-- + 2 joins — e repetia tudo a cada 5 s. Aqui: cadeia de merge e leads
-- resolvidas no banco, só as colunas que a tela usa, 50 por página, ordem
-- estável (created_at, id) e cursor keyset para as antigas.
-- SECURITY INVOKER: a RLS de messages/clients_people/leads continua valendo.

CREATE INDEX IF NOT EXISTS idx_messages_people_created ON public.messages (people_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_lead_created   ON public.messages (lead_id,   created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.get_person_messages(
  p_people_id uuid,
  p_before_at timestamptz DEFAULT NULL,
  p_before_id bigint      DEFAULT NULL,
  p_limit     int         DEFAULT 50
)
RETURNS TABLE (
  id bigint, lead_id uuid, people_id uuid, from_contact text, content text, message_type text,
  status text, whatsapp_template_id text, channel text, created_at timestamptz, sent_at timestamptz,
  user_id uuid, user_name text, media_url text, media_metadata jsonb, source_type text, metadata jsonb,
  parent_message_id bigint, wa_message_id text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH RECURSIVE chain AS (
    SELECT p.id, p.merged_into_id, 0 AS depth FROM public.clients_people p WHERE p.id = p_people_id
    UNION ALL
    SELECT p.id, p.merged_into_id, c.depth + 1 FROM public.clients_people p
    JOIN chain c ON p.id = c.merged_into_id WHERE c.depth < 5
  ),
  ids AS (SELECT id FROM chain),
  lds AS (SELECT l.id FROM public.leads l WHERE l.people_id IN (SELECT id FROM ids) LIMIT 50),
  cand AS (
    (SELECT m.id FROM public.messages m
      WHERE m.people_id IN (SELECT id FROM ids)
        AND (p_before_at IS NULL OR (m.created_at, m.id) < (p_before_at, p_before_id))
      ORDER BY m.created_at DESC, m.id DESC LIMIT greatest(1, least(p_limit, 200)))
    UNION
    (SELECT m.id FROM public.messages m
      WHERE m.lead_id IN (SELECT id FROM lds)
        AND (p_before_at IS NULL OR (m.created_at, m.id) < (p_before_at, p_before_id))
      ORDER BY m.created_at DESC, m.id DESC LIMIT greatest(1, least(p_limit, 200)))
  )
  SELECT m.id, m.lead_id, m.people_id, m.from_contact, m.content, m.message_type,
         m.status, m.whatsapp_template_id, m.channel, m.created_at, m.sent_at,
         m.user_id, u.name, m.media_url, m.media_metadata, m.source_type, m.metadata,
         m.parent_message_id, m.wa_message_id
  FROM public.messages m
  JOIN cand ON cand.id = m.id
  LEFT JOIN public.settings_users u ON u.id = m.user_id
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT greatest(1, least(p_limit, 200));
$$;
REVOKE EXECUTE ON FUNCTION public.get_person_messages(uuid, timestamptz, bigint, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_person_messages(uuid, timestamptz, bigint, int) TO authenticated, service_role;
