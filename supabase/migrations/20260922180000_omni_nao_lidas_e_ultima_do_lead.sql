-- OMNI-01 — Fila de conversas: não lidas em primeiro e filtro por quem falou por último.
--
-- A lista ordenava só por atividade recente: uma conversa com cliente esperando
-- resposta ficava abaixo de outra onde o próprio time acabou de escrever. Quem
-- está esperando passa a subir.
--
-- "Quem mandou a última mensagem" era caro de descobrir na hora (um LATERAL em
-- messages por linha, antes do LIMIT). Vira coluna mantida por gatilho: a
-- escrita é uma por mensagem, a leitura é instantânea.

ALTER TABLE public.clients_people
  ADD COLUMN IF NOT EXISTS last_message_from text,
  ADD COLUMN IF NOT EXISTS last_message_at   timestamptz;

COMMENT ON COLUMN public.clients_people.last_message_from IS
  'Quem mandou a última mensagem da conversa (messages.from_contact: cliente, agente_ia, humano, sistema). Mantido por trg_touch_last_message.';

CREATE OR REPLACE FUNCTION public.touch_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.people_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.clients_people
  SET last_message_from = NEW.from_contact,
      last_message_at   = NEW.created_at
  WHERE id = NEW.people_id
    -- Mensagem antiga inserida fora de ordem não pode sobrescrever a última.
    AND (last_message_at IS NULL OR NEW.created_at >= last_message_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_last_message ON public.messages;
CREATE TRIGGER trg_touch_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_last_message();

-- Backfill: a última mensagem de cada conversa que já existe.
WITH ultima AS (
  SELECT DISTINCT ON (people_id) people_id, from_contact, created_at
  FROM public.messages
  WHERE people_id IS NOT NULL
  ORDER BY people_id, created_at DESC
)
UPDATE public.clients_people p
SET last_message_from = u.from_contact,
    last_message_at   = u.created_at
FROM ultima u
WHERE u.people_id = p.id
  AND p.last_message_at IS DISTINCT FROM u.created_at;

CREATE INDEX IF NOT EXISTS idx_clients_people_aguardando
  ON public.clients_people (last_message_at DESC)
  WHERE last_message_from = 'cliente';
