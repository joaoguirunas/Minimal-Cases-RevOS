-- Hardening de 20260730190000 (NOTIF-01) e 20260730191000 (NOTIF-02), que já estão
-- aplicadas no LIVE e por isso são imutáveis. Três correções do pré-review do dev-qa.

BEGIN;

-- ── A. Furo de RLS: people_id NULL escapava do gate ───────────────────────────
--
-- notifications.people_id é nullable e person_conversation_accessible_to_current_user()
-- retorna true para NULL. Como a função é o gate único das policies, o primeiro
-- event_type sem pessoa associada (meeting_scheduled, followup_due...) ficaria
-- visível para QUALQUER usuário autenticado — e silenciosamente, porque hoje toda
-- linha tem people_id. Fail-closed nos dois níveis: no predicado e na policy.

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
    RETURN false;  -- fail-closed: idêntico ao que a policy de messages faz com people_id NULL
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
  'Extração 1:1 do predicado da policy authenticated_read de messages (20260729231500). Fonte única de "esse usuário pode ver a conversa dessa pessoa?". p_people_id NULL => false (fail-closed), igual ao que a policy de messages faz. Quem adicionar notificação sem pessoa associada precisa de um gate próprio.';

DROP POLICY notifications_read      ON public.notifications;
DROP POLICY notifications_mark_read ON public.notifications;

CREATE POLICY notifications_read ON public.notifications FOR SELECT
USING (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id));

CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE
USING      (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id))
WITH CHECK (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id));

-- ── E. Colapso de rajada precisa ser atômico ─────────────────────────────────
--
-- O padrão "UPDATE; IF NOT FOUND THEN INSERT" não segura concorrência: duas inbounds
-- simultâneas do mesmo people_id não acham notificação aberta e ambas inserem, gerando
-- 2 linhas abertas e badge dobrado. Índice UNIQUE + ON CONFLICT DO UPDATE andam JUNTOS:
-- só o índice faria a violação cair no EXCEPTION WHEN OTHERS do trigger, trocando um
-- bug barulhento por um mudo (notificação sumida sem rastro).

DROP INDEX public.idx_notifications_open;

CREATE UNIQUE INDEX idx_notifications_open
  ON public.notifications (people_id, event_type)
  WHERE read_at IS NULL;

COMMENT ON INDEX public.idx_notifications_open IS
  'UNIQUE de propósito: garante no banco a invariante "no máximo 1 notificação aberta por (pessoa, tipo)". É o alvo do ON CONFLICT do trigger bump_clients_people_on_message.';

-- ── Trigger: INSERT ... ON CONFLICT DO UPDATE ────────────────────────────────

CREATE OR REPLACE FUNCTION public.bump_clients_people_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.from_contact = 'cliente' THEN
    SELECT name INTO v_name FROM public.clients_people WHERE id = NEW.people_id;

    INSERT INTO public.notifications
      (event_type, people_id, lead_id, message_id, title, body, channel, unread_messages)
    VALUES
      ('inbound_message', NEW.people_id, NEW.lead_id, NEW.id,
       left(COALESCE(v_name, 'Contato sem nome'), 120),
       left(COALESCE(NEW.content, ''), 280),
       NEW.channel, 1)
    ON CONFLICT (people_id, event_type) WHERE read_at IS NULL
    DO UPDATE SET
      message_id      = EXCLUDED.message_id,
      body            = EXCLUDED.body,
      channel         = EXCLUDED.channel,
      unread_messages = notifications.unread_messages + 1,
      created_at      = now(),
      lead_id         = COALESCE(EXCLUDED.lead_id, notifications.lead_id);
      -- title não é atualizado: preserva o nome de quando a rajada começou.

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
  RETURN NEW;  -- PRESERVAR: falha de contador/notificação nunca derruba a ingestão
END;
$function$;

-- ── B. Race entre marcar lido e inbound concorrente ──────────────────────────
--
-- Os dois UPDATEs não são atômicos entre si. Se uma inbound chega no meio, o trigger
-- dela incrementa unread_count e o "SET unread_count = 0" seguinte apaga o incremento:
-- fica mensagem com seen_at IS NULL e contador 0 — badge some, ninguém responde o cliente.
-- Não é borda: acontece sempre que o atendente abre a thread na hora que o cliente escreve.
--
-- Correções:
--   1. Descontar exatamente o que foi marcado, em vez de zerar.
--   2. Recomputar first_unread_at (zerar perderia o "esperando há Xh" da mensagem nova).
--   3. Fechar a notificação escopada pelas mensagens efetivamente marcadas. O escopo é por
--      message_id, não por timestamp: messages.id é bigserial e a ordem de commit não
--      acompanha a do relógio, então um cutoff temporal ainda deixaria janela de corrida.

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_people_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
  v_max_id  bigint;
BEGIN
  IF p_people_id IS NULL OR v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- SECURITY DEFINER fura RLS: revalidar acesso na unha.
  IF NOT public.person_conversation_accessible_to_current_user(p_people_id) THEN
    RAISE EXCEPTION 'sem acesso a esta conversa';
  END IF;

  WITH marked AS (
    UPDATE public.messages
       SET seen_at = now()
     WHERE people_id = p_people_id
       AND from_contact = 'cliente'
       AND seen_at IS NULL
    RETURNING id
  )
  SELECT count(*), max(id) INTO v_marked, v_max_id FROM marked;

  -- updated_at NÃO é bumpado: ler uma conversa não pode ressuscitá-la
  -- no topo do Omni, que ordena por updated_at DESC.
  UPDATE public.clients_people cp
     SET unread_count    = GREATEST(cp.unread_count - v_marked, 0),
         first_unread_at = (
           SELECT min(m.created_at) FROM public.messages m
            WHERE m.people_id = p_people_id
              AND m.from_contact = 'cliente'
              AND m.seen_at IS NULL
         ),
         last_read_at    = now(),
         last_read_by    = v_user_id
   WHERE cp.id = p_people_id;

  IF v_max_id IS NOT NULL THEN
    UPDATE public.notifications
       SET read_at = now(),
           read_by = v_user_id
     WHERE people_id = p_people_id
       AND read_at IS NULL
       AND (message_id IS NULL OR message_id <= v_max_id);

    -- Se uma inbound chegou no meio, a notificação dela sobrevive ao fechamento acima —
    -- mas com unread_messages contando também as mensagens que acabaram de ser lidas
    -- ("6 mensagens" no sino quando só 1 está por ler). Recomputa da verdade: o índice
    -- UNIQUE garante no máximo 1 notificação aberta por (pessoa, tipo), então todas as
    -- inbounds ainda não vistas pertencem a ela.
    UPDATE public.notifications
       SET unread_messages = GREATEST((
             SELECT count(*) FROM public.messages m
              WHERE m.people_id = p_people_id
                AND m.from_contact = 'cliente'
                AND m.seen_at IS NULL
           ), 1)
     WHERE people_id = p_people_id
       AND read_at IS NULL;
  END IF;

  RETURN v_marked;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

COMMIT;
