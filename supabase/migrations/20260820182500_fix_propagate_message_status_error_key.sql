-- Fix propagate_message_status_to_sends(): it read metadata->>'last_error' for the
-- failure text, but whatsapp-inbound's handleStatusUpdates() actually writes the Meta
-- failure detail under metadata->'delivery_error' (an object: code/title/error_data/at),
-- not a flat 'last_error' string. Result: sends_contacts.error_message was always NULL
-- on real delivery failures (status='error'), even though the underlying messages row
-- had the real Meta error (e.g. code 131049 "healthy ecosystem engagement" marketing cap).
CREATE OR REPLACE FUNCTION public.propagate_message_status_to_sends()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_rank int;
  v_send_id  uuid;
BEGIN
  IF NEW.source_type IS DISTINCT FROM 'campaign' OR NEW.module_ref_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_send_id := NEW.module_ref_id;

  v_new_rank := CASE NEW.status
    WHEN 'pending'   THEN 0
    WHEN 'sending'   THEN 1
    WHEN 'sent'      THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'read'      THEN 4
    WHEN 'error'     THEN 5
    WHEN 'failed'    THEN 5
    ELSE -1
  END;

  IF v_new_rank < 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.sends_contacts sc
  SET
    status = CASE
      WHEN v_new_rank > COALESCE(
        CASE sc.status
          WHEN 'pending'   THEN 0
          WHEN 'sending'   THEN 1
          WHEN 'sent'      THEN 2
          WHEN 'delivered' THEN 3
          WHEN 'read'      THEN 4
          WHEN 'error'     THEN 5
          WHEN 'failed'    THEN 5
          ELSE -1
        END, -1)
      THEN NEW.status
      ELSE sc.status
    END,
    delivered_at = CASE
      WHEN NEW.status IN ('delivered','read') AND sc.delivered_at IS NULL
      THEN COALESCE(NEW.delivered_at, now())
      ELSE sc.delivered_at
    END,
    read_at = CASE
      WHEN NEW.status = 'read' AND sc.read_at IS NULL
      THEN COALESCE(NEW.read_at, now())
      ELSE sc.read_at
    END,
    error_message = CASE
      WHEN NEW.status IN ('error','failed')
      THEN COALESCE(
        NEW.metadata->>'last_error',
        NEW.metadata->'delivery_error'->>'title',
        NEW.metadata->'delivery_error'->>'code',
        sc.error_message
      )
      ELSE sc.error_message
    END
  WHERE sc.send_id   = v_send_id
    AND sc.people_id = NEW.people_id;

  RETURN NEW;
END;
$function$;
