-- Canal "atual" de cada lead — resolve o bug de roteamento que afeta IA/FUP/
-- Sends PRO: hoje, uma vez que existe canal padrão configurado, TODA resposta
-- vai por ele, nunca pelo canal que o cliente está de fato usando (Meta ou
-- Evolution, quando os dois estão conectados). `active_channel_id` passa a
-- ser a fonte de verdade única, atualizada automaticamente a cada mensagem de
-- conversa real e sobrescrevível manualmente na UI (Kanban/Omni).
--
-- `wa_phone_number_id` (em messages) guarda ou o phone_number_id real (Meta)
-- ou o id (uuid, como texto) do canal (Evolution) — convenção já estabelecida
-- na migration da Evolution. O lookup abaixo cobre os dois formatos.

BEGIN;

ALTER TABLE public.clients_people
  ADD COLUMN active_channel_id uuid REFERENCES public.settings_whatsapp_channels(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients_people.active_channel_id IS
  'Canal WhatsApp (settings_whatsapp_channels) que esse lead está usando agora — Meta ou Evolution, quando os dois coexistem. Atualizado automaticamente por trg_sync_active_channel a cada mensagem de conversa real (exceto campaign, que não deve reatribuir); sobrescrevível manualmente na UI.';

-- ── Backfill: última mensagem de cada pessoa que tenha wa_phone_number_id ────

WITH last_channel AS (
  SELECT DISTINCT ON (m.people_id)
    m.people_id,
    c.id AS channel_id
  FROM public.messages m
  JOIN public.settings_whatsapp_channels c
    ON c.phone_number_id = m.wa_phone_number_id OR c.id::text = m.wa_phone_number_id
  WHERE m.channel = 'whatsapp'
    AND m.wa_phone_number_id IS NOT NULL
    AND m.people_id IS NOT NULL
  ORDER BY m.people_id, m.created_at DESC
)
UPDATE public.clients_people p
   SET active_channel_id = lc.channel_id
  FROM last_channel lc
 WHERE p.id = lc.people_id;

-- ── Trigger: mantém active_channel_id em sincronia com a conversa real ──────

CREATE OR REPLACE FUNCTION public.sync_active_channel_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resolved_channel_id uuid;
BEGIN
  IF NEW.channel <> 'whatsapp' OR NEW.wa_phone_number_id IS NULL OR NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- campaign é broadcast pontual pra um canal escolhido pelo admin — não
  -- reflete "o cliente passou a usar esse canal", então não reatribui.
  IF NEW.source_type = 'campaign' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO resolved_channel_id
    FROM public.settings_whatsapp_channels
   WHERE phone_number_id = NEW.wa_phone_number_id OR id::text = NEW.wa_phone_number_id
   LIMIT 1;

  IF resolved_channel_id IS NOT NULL THEN
    UPDATE public.clients_people
       SET active_channel_id = resolved_channel_id
     WHERE id = NEW.people_id
       AND (active_channel_id IS DISTINCT FROM resolved_channel_id);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- nunca pode derrubar o envio/recebimento da mensagem em si
END;
$function$;

COMMENT ON FUNCTION public.sync_active_channel_from_message IS
  'AFTER INSERT em messages: resolve o canal (Meta ou Evolution) a partir de wa_phone_number_id e atualiza clients_people.active_channel_id. Ignora campaign (broadcast não deve redefinir o canal "de conversa" do lead).';

CREATE TRIGGER trg_sync_active_channel
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_active_channel_from_message();

-- smoke test: confirma que compilou
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='clients_people' AND column_name='active_channel_id') AS column_ok,
  (SELECT count(*) FROM pg_trigger WHERE tgname='trg_sync_active_channel') AS trigger_ok;

COMMIT;
