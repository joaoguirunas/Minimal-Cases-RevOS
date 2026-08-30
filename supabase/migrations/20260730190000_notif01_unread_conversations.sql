-- NOTIF-01: rastreio de mensagens inbound não lidas (Omni + Kanban).
--
-- messages.read_at NÃO é reutilizada: é o recibo de leitura do WhatsApp
-- (o CLIENTE leu a NOSSA mensagem outbound), escrito por whatsapp-inbound e
-- send-status-callback e lido pelo BI. Semântica oposta. Coluna nova: seen_at.

BEGIN;

-- ── 1. messages.seen_at ───────────────────────────────────────────────────────

ALTER TABLE public.messages ADD COLUMN seen_at timestamptz;

COMMENT ON COLUMN public.messages.seen_at IS
  'Quando um atendente HUMANO abriu a thread e viu esta mensagem inbound. NÃO confundir com read_at, que é o recibo de leitura do WhatsApp (cliente leu nossa mensagem outbound). Só é preenchida para from_contact = ''cliente''.';

CREATE INDEX idx_messages_unread_by_person
  ON public.messages (people_id)
  WHERE from_contact = 'cliente' AND seen_at IS NULL;

-- Sem isso o sistema nasce com todo o histórico marcado como não lido.
UPDATE public.messages
   SET seen_at = created_at
 WHERE from_contact = 'cliente' AND seen_at IS NULL;

-- ── 2. clients_people: cache denormalizado que a UI lê ────────────────────────

ALTER TABLE public.clients_people
  ADD COLUMN unread_count    integer     NOT NULL DEFAULT 0,
  ADD COLUMN first_unread_at timestamptz,
  ADD COLUMN last_read_at    timestamptz,
  ADD COLUMN last_read_by    uuid REFERENCES public.settings_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients_people.unread_count IS
  'Cache de COUNT(*) de messages inbound com seen_at IS NULL. Mantido pelo trigger bump_clients_people_on_message (insert) e zerado por mark_conversation_read(). Reparável via recalc_unread_count().';
COMMENT ON COLUMN public.clients_people.first_unread_at IS
  'created_at da mensagem que abriu a rajada não lida atual — usado pra "esperando há Xh" no Omni/Kanban.';
COMMENT ON COLUMN public.clients_people.last_read_by IS
  'Último atendente que abriu a thread. Inbox é compartilhado, então isso é o único sinal de "quem pegou essa conversa".';

CREATE INDEX idx_clients_people_unread
  ON public.clients_people (unread_count)
  WHERE unread_count > 0;

-- ── 3. Predicado de acesso à conversa (extração 1:1 da policy de messages) ────

CREATE OR REPLACE FUNCTION public.person_conversation_accessible_to_current_user(p_people_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_people_id IS NULL THEN
    RETURN true;  -- evento não atrelado a conversa não é restrito por pessoa
  END IF;

  IF public.is_admin_or_manager() THEN
    RETURN true;
  END IF;

  v_user_id := public.get_current_settings_user_id();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN
    EXISTS (SELECT 1 FROM public.clients_people cp
             WHERE cp.id = p_people_id AND cp.created_by = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                WHERE l.people_id = p_people_id AND l.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                 JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
                WHERE l.people_id = p_people_id AND sut.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.leads l
                WHERE l.people_id = p_people_id
                  AND public.lead_pipeline_accessible_to_current_user(l.leads_pipelines_id));
END;
$function$;

COMMENT ON FUNCTION public.person_conversation_accessible_to_current_user IS
  'Extração 1:1 do predicado da policy authenticated_read de messages (20260729231500). Fonte única de "esse usuário pode ver a conversa dessa pessoa?". Usada por notifications e por mark_conversation_read.';

GRANT EXECUTE ON FUNCTION public.person_conversation_accessible_to_current_user(uuid) TO authenticated;

-- ── 4. Trigger existente ganha o contador (segue sendo UM trigger só) ─────────

CREATE OR REPLACE FUNCTION public.bump_clients_people_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.from_contact = 'cliente' THEN
    UPDATE public.clients_people
       SET updated_at      = now(),
           unread_count    = unread_count + 1,
           first_unread_at = COALESCE(first_unread_at, NEW.created_at, now())
     WHERE id = NEW.people_id;
  ELSE
    UPDATE public.clients_people SET updated_at = now() WHERE id = NEW.people_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- PRESERVAR: bug de contador nunca pode derrubar a ingestão de mensagem
END;
$function$;

-- ── 5. mark_conversation_read: caminho único de escrita da leitura ────────────

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_people_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
BEGIN
  IF p_people_id IS NULL OR v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- SECURITY DEFINER fura RLS: revalidar acesso na unha.
  IF NOT public.person_conversation_accessible_to_current_user(p_people_id) THEN
    RAISE EXCEPTION 'sem acesso a esta conversa';
  END IF;

  UPDATE public.messages
     SET seen_at = now()
   WHERE people_id = p_people_id
     AND from_contact = 'cliente'
     AND seen_at IS NULL;
  GET DIAGNOSTICS v_marked = ROW_COUNT;

  -- updated_at NÃO é bumpado: ler uma conversa não pode ressuscitá-la
  -- no topo do Omni, que ordena por updated_at DESC.
  UPDATE public.clients_people
     SET unread_count    = 0,
         first_unread_at = NULL,
         last_read_at    = now(),
         last_read_by    = v_user_id
   WHERE id = p_people_id;

  RETURN v_marked;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- ── 6. Reparo do contador denormalizado ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalc_unread_count(p_people_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.clients_people cp
     SET unread_count    = COALESCE(agg.n, 0),
         first_unread_at = agg.first_at
    FROM (
      SELECT p.id,
             COUNT(m.id)       AS n,
             MIN(m.created_at) AS first_at
        FROM public.clients_people p
        LEFT JOIN public.messages m
               ON m.people_id = p.id
              AND m.from_contact = 'cliente'
              AND m.seen_at IS NULL
       WHERE p_people_id IS NULL OR p.id = p_people_id
       GROUP BY p.id
    ) agg
   WHERE cp.id = agg.id;
$function$;

COMMENT ON FUNCTION public.recalc_unread_count IS
  'Reparo idempotente do cache clients_people.unread_count/first_unread_at a partir de messages. Ferramenta de operação — roda como service_role, sem GRANT para authenticated.';

REVOKE EXECUTE ON FUNCTION public.recalc_unread_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_unread_count(uuid) FROM anon, authenticated;

COMMIT;
