-- Nova etapa "4 | Atendimento humano" no pipeline "2 | Eventos" (8d63cba1-a25c-41de-baec-e32c3eb50015).
-- "4 | Inscrito" passa a ser "5 | Inscrito" pra abrir espaço.
-- Regra: qualquer lead que entrar nessa etapa (por qualquer via) tem a IA desativada
-- automaticamente, garantindo que só o atendente humano decide quando mover alguém
-- pra lá — a partir daí a IA nunca mais responde esse contato sem intervenção manual.

UPDATE leads_stages
SET name = '5 | Inscrito', order_index = 5
WHERE id = '3efe2e7b-72a1-4c0d-8bd2-1b71ce46a723';

INSERT INTO leads_stages (leads_pipelines_id, name, color, order_index, active)
VALUES ('8d63cba1-a25c-41de-baec-e32c3eb50015', '4 | Atendimento humano', '#F97316', 4, true);

CREATE OR REPLACE FUNCTION public.disable_ai_on_atendimento_humano()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.leads_stages_id = '6ba2f54b-223a-4fe6-8afb-c42160e617ea' AND NEW.people_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.leads_stages_id IS DISTINCT FROM OLD.leads_stages_id) THEN
    UPDATE public.clients_people
    SET ai_enabled = false
    WHERE id = NEW.people_id AND ai_enabled IS DISTINCT FROM false;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_disable_ai_on_atendimento_humano ON public.leads;
CREATE TRIGGER trg_disable_ai_on_atendimento_humano
AFTER INSERT OR UPDATE OF leads_stages_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.disable_ai_on_atendimento_humano();
