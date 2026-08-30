-- Notifica o closer (meetings.user_id) quando uma reunião é agendada com ele:
-- sino (notifications, canal já existente) + WhatsApp (template
-- aviso_reuniao_agendada_closer_v1, registrado no Meta e pendente de aprovação).
--
-- Duas peças novas:
--   1. notifications ganha target_user_id — alerta PESSOAL (closer), distinto do
--      alerta por conversa (people_id) que já existe. RLS, mark_all e um novo RPC
--      mark_notification_read() passam a reconhecer as duas formas de visibilidade.
--   2. Trigger AFTER INSERT em meetings dispara o sino (transacional) e, fire-and-
--      forget, chama a edge function notify-closer-meeting (que resolve telefone/
--      template e envia via whatsapp-outbound — mesma arquitetura já usada por
--      notify_lead_stage_changed/followup-enqueue).

BEGIN;

-- ── 1. Coluna nova ──────────────────────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN target_user_id uuid REFERENCES public.settings_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.notifications.target_user_id IS
  'Alerta PESSOAL pra um settings_users específico (ex: closer avisado de reunião marcada), distinto da visibilidade por conversa via people_id. Uma linha pode ter os dois: people_id dá acesso a quem vê a conversa do lead, target_user_id garante que o destinatário específico sempre vê, mesmo sem acesso à conversa.';

CREATE INDEX idx_notifications_target_user
  ON public.notifications (target_user_id)
  WHERE target_user_id IS NOT NULL;

-- ── 2. RLS: reconhecer a segunda forma de visibilidade ───────────────────────

DROP POLICY notifications_read ON public.notifications;

CREATE POLICY notifications_read ON public.notifications FOR SELECT
USING (
  (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id))
  OR (target_user_id IS NOT NULL AND target_user_id = public.get_current_settings_user_id())
);

-- ── 3. mark_conversation_read: NÃO fecha alerta pessoal de outro tipo ────────
--
-- O UPDATE final fechava QUALQUER notificação daquele people_id, sem filtrar por
-- tipo. Isso deixaria um manager que abre a conversa do lead apagar, de tabela,
-- o aviso pessoal "você tem reunião" do closer antes dele ver — dois usuários
-- diferentes, uma ação nem percebe que afetou a outra. Alerta pessoal só fecha
-- via mark_notification_read (clique nele) ou mark_all_notifications_read
-- (do próprio destinatário).

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
       AND target_user_id IS NULL
       AND (message_id IS NULL OR message_id <= v_max_id);

    UPDATE public.notifications
       SET unread_messages = GREATEST((
             SELECT count(*) FROM public.messages m
              WHERE m.people_id = p_people_id
                AND m.from_contact = 'cliente'
                AND m.seen_at IS NULL
           ), 1)
     WHERE people_id = p_people_id
       AND read_at IS NULL
       AND target_user_id IS NULL;
  END IF;

  RETURN v_marked;
END;
$function$;

-- ── 4. mark_all_notifications_read: fecha os dois tipos de alerta do próprio usuário ─

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
  v_marked  integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.notifications
     SET read_at = now(),
         read_by = v_user_id
   WHERE read_at IS NULL
     AND (
       (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id))
       OR (target_user_id IS NOT NULL AND target_user_id = v_user_id)
     );

  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RETURN v_marked;
END;
$function$;

-- ── 5. mark_notification_read: fecha UMA notificação específica pelo id ─────
--
-- Complementa mark_conversation_read (que fecha por people_id + cascateia pra
-- messages/clients_people — certo pra 'inbound_message', errado pra um alerta
-- pessoal que não é sobre "li a conversa"). Usado pelo clique em notificações
-- que não são inbound_message (hoje: meeting_scheduled).

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := public.get_current_settings_user_id();
BEGIN
  IF p_notification_id IS NULL OR v_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.notifications
     SET read_at = now(),
         read_by = v_user_id
   WHERE id = p_notification_id
     AND read_at IS NULL
     AND (
       (people_id IS NOT NULL AND public.person_conversation_accessible_to_current_user(people_id))
       OR (target_user_id IS NOT NULL AND target_user_id = v_user_id)
     );

  RETURN FOUND;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- ── 6. Trigger: reunião agendada → sino (transacional) + WhatsApp (fire-and-forget) ──
--
-- meeting_scheduled já existe no enum notification_event_type (20260423005000),
-- nunca tinha consumidor. Só dispara em INSERT (o momento de "marcou reunião");
-- reagendar/mudar status não deve re-notificar o closer.

CREATE OR REPLACE FUNCTION public.notify_closer_on_meeting_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lead_name    text;
  v_closer_phone text;
  v_time_label   text;
  v_supabase_url text;
  v_service_key  text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('agendada', 'agendado') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_lead_name FROM public.clients_people WHERE id = NEW.people_id;
  SELECT phone INTO v_closer_phone FROM public.settings_users WHERE id = NEW.user_id;

  v_time_label := to_char(NEW.start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');

  INSERT INTO public.notifications
    (event_type, people_id, lead_id, target_user_id, title, body, channel, unread_messages)
  VALUES
    ('meeting_scheduled', NEW.people_id, NEW.lead_id, NEW.user_id,
     'Reunião agendada: ' || COALESCE(v_lead_name, 'Lead'),
     'Marcada para ' || v_time_label,
     'meeting', 1);

  -- Envio de WhatsApp isolado num sub-bloco de propósito: EXCEPTION de bloco
  -- PL/pgSQL reverte pro savepoint do INÍCIO do bloco que a contém. Sem isolar
  -- aqui, uma falha no http_post (edge function fora do ar, DNS, timeout)
  -- desfaria também o INSERT em notifications de cima — o sino sumiria junto
  -- com o WhatsApp que falhou. Confirmado via dry-run: sem este sub-bloco, o
  -- teste "insere reunião com notify-closer-meeting ainda não deployado"
  -- resultava em ZERO notificações (não só zero envios de WA).
  BEGIN
    IF v_closer_phone IS NOT NULL AND v_closer_phone <> '' THEN
      SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
      SELECT value INTO v_service_key  FROM public._app_config WHERE key = 'service_role_key';
      IF v_supabase_url IS NOT NULL AND v_supabase_url <> '' AND v_service_key IS NOT NULL AND v_service_key <> '' THEN
        PERFORM extensions.http_post(
          url := v_supabase_url || '/functions/v1/notify-closer-meeting',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
          body := jsonb_build_object('meeting_id', NEW.id::text)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- WhatsApp é best-effort; o sino já inserido acima sobrevive
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- alerta de reunião nunca pode derrubar o agendamento em si
END;
$function$;

COMMENT ON FUNCTION public.notify_closer_on_meeting_scheduled IS
  'AFTER INSERT em meetings: cria o alerta pessoal (sino) do closer (NEW.user_id) na mesma transação e dispara notify-closer-meeting (fire-and-forget) pro envio de WhatsApp. EXCEPTION WHEN OTHERS THEN RETURN NEW — nunca pode bloquear o INSERT da reunião.';

DROP TRIGGER IF EXISTS trg_notify_closer_on_meeting_scheduled ON public.meetings;
CREATE TRIGGER trg_notify_closer_on_meeting_scheduled
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.notify_closer_on_meeting_scheduled();

-- smoke test: confirma que as duas funções e a policy compilaram e a trigger existe
SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_notify_closer_on_meeting_scheduled') AS trigger_criada,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_read') AS policy_ok,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'target_user_id') AS coluna_ok;

COMMIT;
