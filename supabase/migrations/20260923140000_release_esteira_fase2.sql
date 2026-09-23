-- Go da Fase 2 — NÃO roda sozinho. Uma chamada, depois da aprovação:
--   select public.release_esteira_fase2();
--
-- 1. liga as regras v2 da Esteira Validação (W1, E4, W2, E5 e os gatilhos de clique);
-- 2. 'held' → 'pending', com os horários recalculados a partir de agora
--    (W1 +30 min, E1 +1h, E2 +1d, E3 +2d, E4 +3d, W2 +3d 1h, E5 +5d, E6 +7d);
-- 3. acrescenta os WhatsApp da Fase 2 à allowlist — a trava continua valendo
--    para todo o resto (agente, outros fluxos, outros números).
-- O worker espaça os WhatsApp em 120 s e segura tudo fora do horário comercial.
CREATE OR REPLACE FUNCTION public.release_esteira_fase2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_rules int; v_touches int; v_numbers int;
BEGIN
  UPDATE public.leads_stages_followups SET active = true, updated_at = now()
   WHERE subject LIKE 'Esteira v2 ·%[Validação]';
  GET DIAGNOSTICS v_rules = ROW_COUNT;

  UPDATE public.followup_queue q
     SET status = 'pending',
         scheduled_for = now() + make_interval(days => coalesce(r.days,0), hours => coalesce(r.hours,0), mins => coalesce(r.minutes,0)),
         updated_at = now()
    FROM public.leads_stages_followups r, public._fase2_leads f
   WHERE q.status = 'held' AND r.id = q.followup_id AND f.lead_id = q.lead_id;
  GET DIAGNOSTICS v_touches = ROW_COUNT;

  WITH nums AS (
    SELECT DISTINCT p.whatsapp AS n FROM public._fase2_leads f JOIN public.clients_people p ON p.id = f.people_id
    WHERE p.whatsapp IS NOT NULL
  ), atual AS (
    SELECT coalesce(settings->'test_allowlist', '[]'::jsonb) AS lst FROM public.omni_channel_configs WHERE channel = 'whatsapp'
  )
  UPDATE public.omni_channel_configs c
     SET settings = c.settings || jsonb_build_object('test_allowlist',
           (SELECT jsonb_agg(DISTINCT x) FROM (
              SELECT jsonb_array_elements_text((SELECT lst FROM atual)) AS x
              UNION SELECT n FROM nums) u))
   WHERE c.channel = 'whatsapp';
  SELECT jsonb_array_length(settings->'test_allowlist') INTO v_numbers FROM public.omni_channel_configs WHERE channel = 'whatsapp';

  RETURN jsonb_build_object('regras_ligadas', v_rules, 'toques_liberados', v_touches, 'numeros_na_allowlist', v_numbers);
END $$;
REVOKE EXECUTE ON FUNCTION public.release_esteira_fase2() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_esteira_fase2() TO service_role;
