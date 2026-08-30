BEGIN;

CREATE OR REPLACE FUNCTION public.bump_clients_people_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.people_id IS NOT NULL THEN
    UPDATE public.clients_people SET updated_at = now() WHERE id = NEW.people_id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.bump_clients_people_on_message IS
  'Atualiza clients_people.updated_at a cada nova mensagem (inbound ou outbound) — é o campo que get_omni_contacts usa pra ordenar/surfacear conversas no Omni. Sem isso, uma conversa nova ou reativada não sobe na lista.';

CREATE TRIGGER bump_clients_people_on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_clients_people_on_message();

COMMIT;
