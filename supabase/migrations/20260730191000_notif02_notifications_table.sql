-- NOTIF-02 (parte 2/2): tabela do sino, RLS, realtime e extensão do trigger.
-- Depende de 20260730190000 (person_conversation_accessible_to_current_user,
-- clients_people.unread_count) e de 20260730190500 (valor 'inbound_message').

BEGIN;

-- ── 1. Tabela ─────────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      public.notification_event_type NOT NULL,
  people_id       uuid   REFERENCES public.clients_people(id) ON DELETE CASCADE,
  lead_id         uuid   REFERENCES public.leads(id)          ON DELETE SET NULL,
  message_id      bigint REFERENCES public.messages(id)       ON DELETE SET NULL,
  title           text NOT NULL,
  body            text,
  channel         text,
  unread_messages integer NOT NULL DEFAULT 1,
  read_at         timestamptz,
  read_by         uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS
  'Feed do sino (DashLayout). Linha GLOBAL: read_at/read_by são únicos, não por usuário — inbox compartilhado, quem atende limpa pra todo mundo. Visibilidade (não leitura) é por usuário via RLS.';
COMMENT ON COLUMN public.notifications.title IS
  'Nome do contato no momento do evento. Denormalizado de propósito: embed via RLS pode voltar null (bug conhecido, 20260717130000).';
COMMENT ON COLUMN public.notifications.unread_messages IS
  'Quantas mensagens inbound essa notificação representa após o colapso da rajada.';
COMMENT ON COLUMN public.notifications.message_id IS
  'bigint — messages.id é serial, não uuid.';

CREATE INDEX idx_notifications_feed   ON public.notifications (created_at DESC);
CREATE INDEX idx_notifications_open   ON public.notifications (people_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_unread ON public.notifications (created_at DESC) WHERE read_at IS NULL;

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_read ON public.notifications FOR SELECT
USING (public.person_conversation_accessible_to_current_user(people_id));

-- Sem policy de INSERT: escrita é exclusiva do trigger SECURITY DEFINER.
CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE
USING     (public.person_conversation_accessible_to_current_user(people_id))
WITH CHECK (public.person_conversation_accessible_to_current_user(people_id));

CREATE POLICY notifications_delete ON public.notifications FOR DELETE
USING (public.is_admin_or_manager());

-- ── 3. Realtime ───────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ── 4. Trigger final: contador + sino, ainda em UM único AFTER INSERT ─────────

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

    -- Colapso de rajada: enquanto ninguém atendeu, a notificação aberta é
    -- atualizada em vez de gerar uma linha nova por mensagem.
    UPDATE public.notifications
       SET message_id      = NEW.id,
           body            = left(COALESCE(NEW.content, ''), 280),
           channel         = NEW.channel,
           unread_messages = unread_messages + 1,
           created_at      = now(),
           lead_id         = COALESCE(NEW.lead_id, lead_id)
     WHERE people_id = NEW.people_id
       AND event_type = 'inbound_message'
       AND read_at IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.notifications
        (event_type, people_id, lead_id, message_id, title, body, channel, unread_messages)
      VALUES
        ('inbound_message', NEW.people_id, NEW.lead_id, NEW.id,
         left(COALESCE(v_name, 'Contato sem nome'), 120),
         left(COALESCE(NEW.content, ''), 280),
         NEW.channel, 1);
    END IF;

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

COMMENT ON FUNCTION public.bump_clients_people_on_message IS
  'AFTER INSERT em messages: bumpa clients_people.updated_at (ordenação do Omni) e, para inbound de cliente, incrementa unread_count e mantém a notificação aberta do sino. Roda no caminho mais quente do sistema — o EXCEPTION WHEN OTHERS THEN RETURN NEW é o que impede um bug aqui de derrubar o webhook de mensagem; não remover.';

-- ── 5. mark_conversation_read passa a fechar o sino na mesma transação ────────

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

  UPDATE public.notifications
     SET read_at = now(),
         read_by = v_user_id
   WHERE people_id = p_people_id
     AND read_at IS NULL;

  RETURN v_marked;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

COMMIT;
