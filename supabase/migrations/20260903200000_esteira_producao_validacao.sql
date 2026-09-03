-- EST-PROD — Separa a esteira em PRODUÇÃO (eventos reais) e VALIDAÇÃO (amostra de teste).
--
-- Antes: um único pipeline "Esteira Minimal — Loja" recebia tanto os 297 leads do
-- backfill (para teste) quanto os webhooks ao vivo, e os pipelines "Clientes" e
-- "Carrinho Abandonado" (import Zoppy) estavam vazios ocupando o kanban.
--
-- Depois:
--   • "Esteira Validação"      — o pipeline atual renomeado, com os 297 leads do
--                                backfill e as 19 regras de follow-up ATIVAS.
--                                Serve para testar a esteira numa amostra.
--   • "Esteira Minimal — Loja" — pipeline novo (mesmos 7 stages), destino dos
--                                webhooks Yampi a partir de agora. As regras são
--                                copiadas INATIVAS: os eventos reais entram e o
--                                lead se move, mas nenhum toque dispara até que
--                                alguém ative depois da validação.
--   • Pipelines "Clientes" e "Carrinho Abandonado" removidos (0 leads; zoppy-sync
--     apenas registra um aviso quando não os encontra).
--
-- O agente de WhatsApp passa a atender os dois pipelines.

BEGIN;

DO $$
DECLARE
  v_val    uuid;   -- pipeline atual (vira validação)
  v_prod   uuid;   -- pipeline novo (produção)
  v_stage  record;
  v_pos    int;
BEGIN
  SELECT id INTO v_val FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja' LIMIT 1;
  IF v_val IS NULL THEN RAISE EXCEPTION 'pipeline "Esteira Minimal — Loja" não encontrado'; END IF;

  -- 1. Atual → validação
  UPDATE public.leads_pipelines SET name = 'Esteira Validação' WHERE id = v_val;

  -- 2. Pipeline de produção com o nome canônico
  INSERT INTO public.leads_pipelines (name, active)
  VALUES ('Esteira Minimal — Loja', true)
  RETURNING id INTO v_prod;

  -- 3. Mesmos stages (nome, cor, ordem)
  FOR v_stage IN
    SELECT name, color, order_index FROM public.leads_stages
    WHERE leads_pipelines_id = v_val AND active = true ORDER BY order_index
  LOOP
    INSERT INTO public.leads_stages (leads_pipelines_id, name, color, order_index, active)
    VALUES (v_prod, v_stage.name, v_stage.color, v_stage.order_index, true);
  END LOOP;

  -- 4. Regras de follow-up copiadas INATIVAS (produção não dispara até validar)
  INSERT INTO public.leads_stages_followups (
    leads_stages_id, type, subject, email_template_id, message, template_id,
    days, hours, minutes, business_hours_only, bh_only_last, active, vars,
    score_matrix_id, control, lead_type, target_stage_id
  )
  SELECT sp.id, f.type, f.subject, f.email_template_id, f.message, f.template_id,
         f.days, f.hours, f.minutes, f.business_hours_only, f.bh_only_last, false, f.vars,
         f.score_matrix_id, f.control, f.lead_type, NULL
  FROM public.leads_stages_followups f
  JOIN public.leads_stages sv ON sv.id = f.leads_stages_id AND sv.leads_pipelines_id = v_val
  JOIN public.leads_stages sp ON sp.leads_pipelines_id = v_prod AND sp.name = sv.name;

  -- 5. Webhooks Yampi passam a mirar produção (mesmos triggers, stages equivalentes)
  UPDATE public.yampi_event_mappings m
  SET target_pipeline_id = v_prod,
      target_stage_id = sp.id
  FROM public.leads_stages sv
  JOIN public.leads_stages sp ON sp.leads_pipelines_id = v_prod AND sp.name = sv.name
  WHERE m.target_stage_id = sv.id AND sv.leads_pipelines_id = v_val;

  -- 6. Agente de WhatsApp atende os dois pipelines
  UPDATE public.ai_agents
  SET pipeline_id = v_prod, pipeline_ids = ARRAY[v_prod, v_val]
  WHERE pipeline_id = v_val;

  -- 7. Pipelines do import Zoppy (vazios) saem do kanban
  DELETE FROM public.leads_stages
  WHERE leads_pipelines_id IN (SELECT id FROM public.leads_pipelines WHERE name IN ('Clientes', 'Carrinho Abandonado'));
  DELETE FROM public.leads_pipelines WHERE name IN ('Clientes', 'Carrinho Abandonado');
END $$;

-- 8. Religa a entrada de leads: os eventos reais agora têm para onde ir.
UPDATE public.yampi_connections SET lead_intake_enabled = true, updated_at = now();

COMMIT;
