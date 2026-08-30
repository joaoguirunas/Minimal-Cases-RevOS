-- Habilitar a extensão pg_net se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função que dispara webhooks do tipo 'novo_lead' automaticamente
CREATE OR REPLACE FUNCTION public.dispatch_novo_lead_webhooks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  webhook_record RECORD;
  payload JSONB;
  cliente_data JSONB;
  request_id BIGINT;
BEGIN
  -- Buscar dados do cliente se existir people_id
  IF NEW.people_id IS NOT NULL THEN
    SELECT to_jsonb(cp.*) INTO cliente_data
    FROM public.clients_people cp
    WHERE cp.id = NEW.people_id;
  END IF;

  -- Montar o payload
  payload := jsonb_build_object(
    'tipo', 'novo_lead',
    'timestamp', now(),
    'lead', to_jsonb(NEW),
    'cliente', COALESCE(cliente_data, '{}'::jsonb)
  );

  -- Iterar sobre webhooks ativos do tipo 'novo_lead'
  FOR webhook_record IN
    SELECT id, url, name
    FROM public.webhooks
    WHERE event_type = 'novo_lead' AND active = true
  LOOP
    BEGIN
      -- Enviar requisição HTTP POST via pg_net
      SELECT extensions.http_post(
        url := webhook_record.url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := payload::text
      ) INTO request_id;

      -- Registrar log do webhook
      INSERT INTO public.webhook_logs (
        webhook_id,
        status_code,
        response_body,
        request_body,
        created_at
      ) VALUES (
        webhook_record.id,
        202, -- Enfileirado
        jsonb_build_object('queued', true, 'request_id', request_id),
        payload,
        now()
      );

    EXCEPTION WHEN OTHERS THEN
      -- Log de erro
      INSERT INTO public.webhook_logs (
        webhook_id,
        status_code,
        response_body,
        request_body,
        created_at
      ) VALUES (
        webhook_record.id,
        500,
        jsonb_build_object('error', SQLERRM, 'queued', false),
        payload,
        now()
      );
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Criar trigger AFTER INSERT em leads
DROP TRIGGER IF EXISTS trigger_dispatch_novo_lead_webhooks ON public.leads;

CREATE TRIGGER trigger_dispatch_novo_lead_webhooks
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_novo_lead_webhooks();