-- Clique no link rastreado move o lead para "Engajou" (YMP-7). O gatilho de troca
-- de etapa cancelava TODOS os toques pendentes e re-enfileirava os da etapa nova —
-- que não tem sequência própria. Resultado: quem clicava perdia E2..E6 e o card
-- mostrava "esteira concluída". O lead mais quente era justamente o que calava.
--
-- 'Em recuperação' e 'Engajou' são etapas de PROGRESSÃO da esteira, não saída dela:
-- a sequência do lead continua valendo. Saídas de verdade (Recuperado, Perdido,
-- Pagamento pendente/recusado, qualquer etapa de outro pipeline) seguem cancelando.

CREATE OR REPLACE FUNCTION public.notify_lead_stage_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  v_supabase_url   TEXT;
  v_service_key    TEXT;
  v_new_stage_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.leads_stages_id IS NOT DISTINCT FROM NEW.leads_stages_id THEN
    RETURN NEW;
  END IF;
  IF NEW.leads_stages_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_new_stage_name FROM public.leads_stages WHERE id = NEW.leads_stages_id;

  -- Nome desconhecido = comportamento antigo (cancela): fail-safe, nunca deixa
  -- uma sequência órfã rodando por falta de informação.
  IF v_new_stage_name IS NULL OR v_new_stage_name NOT IN ('Em recuperação', 'Engajou') THEN
    UPDATE public.followup_queue
    SET status = 'cancelled', fired_at = now(), error_message = 'Cancelado: lead mudou de etapa'
    WHERE lead_id = NEW.id AND status = 'pending' AND source_type = 'stage';
  END IF;

  SELECT value INTO v_supabase_url FROM public._app_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key  FROM public._app_config WHERE key = 'service_role_key';
  IF v_supabase_url IS NULL OR v_supabase_url = '' OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/dispara-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('tipo', 'lead_etapa', 'lead_id', NEW.id::text)
  );
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/followup-enqueue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
    body := jsonb_build_object('lead_id', NEW.id::text, 'stage_id', NEW.leads_stages_id::text, 'source_type', 'stage')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.webhook_logs (webhook_id, status_code, response_body, request_body, created_at)
  VALUES (NULL, 500, jsonb_build_object('error', SQLERRM, 'source', 'notify_lead_stage_changed'), jsonb_build_object('lead_id', NEW.id::text), now());
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.notify_lead_stage_changed() IS
  'AFTER UPDATE de leads_stages_id: cancela os toques pendentes da sequência antiga, avisa o webhook e re-enfileira os toques da etapa nova. Exceção: "Em recuperação" e "Engajou" são progressão da esteira (1º toque disparado / clique em link) e NÃO cancelam a sequência em andamento.';
