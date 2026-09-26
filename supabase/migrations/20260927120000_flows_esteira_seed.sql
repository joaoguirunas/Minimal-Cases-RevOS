-- supabase/migrations/20260927120000_flows_esteira_seed.sql
-- "Esteira v2 — Loja" e os fluxos de clique, gerados da sequência v2 que roda hoje (regras da Esteira Validação:
-- 'Esteira v2 · …[Validação]' + E1/E2/E3/E6), ligados aos carrinhos do pipeline Loja. A esteira da Loja está
-- desligada nas regras; estes fluxos ficam em 'simulation' (nada é enviado) até a decisão de ligar.
-- Status 'simulation': nada é enviado; o motor da loja continua 'rules'.
DO $$
DECLARE
  v_pipe uuid := (SELECT id FROM public.leads_pipelines WHERE name = 'Esteira Validação');
  v_stage uuid := '3a5eb8c6-8707-4cb5-bac0-3e3d646c6ec0'; -- etapa da Validação onde está a sequência v2
  r record; v_nodes jsonb := '[]'; v_edges jsonb := '[]'; v_prev text := 'trigger'; v_prev_min int := 0; v_y int := 140; v_i int := 0;
  v_flow uuid; v_ver uuid; v_click uuid; v_node text; v_wait int; v_type text;
BEGIN
  v_nodes := v_nodes || jsonb_build_object('id','trigger','type','trigger','position',jsonb_build_object('x',0,'y',0),'data','{}'::jsonb);
  FOR r IN
    SELECT f.*, (coalesce(f.days,0)*1440 + coalesce(f.hours,0)*60 + coalesce(f.minutes,0)) AS mins
      FROM public.leads_stages_followups f
     WHERE f.leads_stages_id = v_stage AND f.trigger_on = 'stage' AND f.ab_variant_id IS NULL
       AND (f.subject LIKE 'Esteira v2 ·%[Validação]' OR f.id IN (
            'eebdb9fd-86f0-44b8-b02f-bb98def4c0ba','37543c07-898e-4ad4-916b-5f97ac8562ed',
            'c816a580-651e-4934-a75d-46fa13f732e3','a45ec099-1e80-4d58-a720-edfc385276a2'))
     ORDER BY mins, f.created_at
  LOOP
    v_i := v_i + 1;
    v_wait := r.mins - v_prev_min;
    IF v_wait > 0 THEN
      v_node := 'wait' || v_i;
      v_nodes := v_nodes || jsonb_build_object('id', v_node, 'type', 'wait', 'position', jsonb_build_object('x', 0, 'y', v_y),
        'data', jsonb_build_object('amount', CASE WHEN v_wait % 1440 = 0 THEN v_wait / 1440 WHEN v_wait % 60 = 0 THEN v_wait / 60 ELSE v_wait END,
                                   'unit', CASE WHEN v_wait % 1440 = 0 THEN 'days' WHEN v_wait % 60 = 0 THEN 'hours' ELSE 'minutes' END));
      v_edges := v_edges || jsonb_build_object('id', 'e-' || v_prev || '-' || v_node, 'source', v_prev, 'sourceHandle', 'out', 'target', v_node);
      v_prev := v_node; v_y := v_y + 140; v_prev_min := r.mins;
    END IF;
    -- W2 (only_if_clicked) vira condição "clicou?" antes do envio
    IF coalesce(r.vars->>'only_if_clicked','') = 'true' THEN
      v_node := 'cond' || v_i;
      v_nodes := v_nodes || jsonb_build_object('id', v_node, 'type', 'condition', 'position', jsonb_build_object('x', 0, 'y', v_y), 'data', jsonb_build_object('check','clicked_since_start'));
      v_edges := v_edges || jsonb_build_object('id', 'e-' || v_prev || '-' || v_node, 'source', v_prev, 'sourceHandle', 'out', 'target', v_node);
      v_prev := v_node; v_y := v_y + 140;
    END IF;
    v_type := CASE WHEN r.type = 'email' THEN 'send_email' ELSE 'send_whatsapp' END;
    v_node := 'send' || v_i;
    v_nodes := v_nodes || jsonb_build_object('id', v_node, 'type', v_type, 'position', jsonb_build_object('x', 0, 'y', v_y),
      'data', jsonb_build_object('template_id', r.template_id, 'email_template_id', r.email_template_id,
                                 'use_personal_coupon', coalesce(r.vars->>'cupom_pessoal','') = 'true',
                                 'vars', coalesce(r.vars, '{}'::jsonb) - 'cupom_pessoal' - 'only_if_clicked', 'rule_id', r.id));
    v_edges := v_edges || jsonb_build_object('id', 'e-' || v_prev || '-' || v_node, 'source', v_prev,
      'sourceHandle', CASE WHEN v_prev LIKE 'cond%' THEN 'yes' ELSE 'out' END, 'target', v_node);
    v_prev := v_node; v_y := v_y + 140;
  END LOOP;
  v_nodes := v_nodes || jsonb_build_object('id','exit','type','exit','position',jsonb_build_object('x',0,'y',v_y),'data','{}'::jsonb);
  v_edges := v_edges || jsonb_build_object('id', 'e-' || v_prev || '-exit', 'source', v_prev, 'sourceHandle', 'out', 'target', 'exit');
  -- liga o ramo "não" de cada condição ao nó que vem depois do envio condicionado
  SELECT jsonb_agg(e) INTO v_edges FROM (
    SELECT e FROM jsonb_array_elements(v_edges) e
    UNION ALL
    SELECT jsonb_build_object('id', 'e-' || (c->>'id') || '-no', 'source', c->>'id', 'sourceHandle', 'no',
           'target', (SELECT e2->>'target' FROM jsonb_array_elements(v_edges) e2
                       WHERE e2->>'source' = (SELECT e3->>'target' FROM jsonb_array_elements(v_edges) e3 WHERE e3->>'source' = c->>'id' AND e3->>'sourceHandle' = 'yes')))
      FROM jsonb_array_elements(v_nodes) c WHERE c->>'type' = 'condition') x;

  INSERT INTO public.flows (name, description, status, trigger_type, trigger_config, draft_graph, reentry)
  VALUES ('Esteira v2 — Loja', 'Gerado da sequência v2 (regras da Esteira Validação, 27/09). Em simulação até a decisão de ligar a esteira da loja.', 'simulation', 'cart_abandoned',
          jsonb_build_object('pipeline', 'Esteira Minimal — Loja'), jsonb_build_object('nodes', v_nodes, 'edges', v_edges), 'after_exit')
  RETURNING id INTO v_flow;
  INSERT INTO public.flow_versions (flow_id, version, graph) VALUES (v_flow, 1, jsonb_build_object('nodes', v_nodes, 'edges', v_edges)) RETURNING id INTO v_ver;
  UPDATE public.flows SET live_version_id = v_ver WHERE id = v_flow;

  -- Fluxo de clique: W-CLICK / E-CLICK uma vez por pessoa (reentry never), só para quem está na esteira
  FOR r IN SELECT f.* FROM public.leads_stages_followups f JOIN public.leads_stages s ON s.id = f.leads_stages_id
            WHERE s.leads_pipelines_id = v_pipe AND f.active AND f.trigger_on IN ('click_whatsapp','click_email') AND f.subject LIKE 'Esteira v2 ·%' LOOP
    v_type := CASE WHEN r.type = 'email' THEN 'send_email' ELSE 'send_whatsapp' END;
    INSERT INTO public.flows (name, description, status, trigger_type, trigger_config, draft_graph, reentry)
    VALUES ('Esteira v2 — Clique ' || CASE WHEN r.trigger_on = 'click_email' THEN 'e-mail' ELSE 'WhatsApp' END || ' (Loja)',
            'Gerado da regra de clique (27/09).', 'simulation', 'link_clicked',
            jsonb_build_object('pipeline', 'Esteira Minimal — Loja', 'channel', replace(r.trigger_on, 'click_', ''), 'require_active_flow', v_flow::text),
            '{}'::jsonb, 'never')
    RETURNING id INTO v_click;
    v_nodes := jsonb_build_array(
      jsonb_build_object('id','trigger','type','trigger','position',jsonb_build_object('x',0,'y',0),'data','{}'::jsonb),
      jsonb_build_object('id','wait','type','wait','position',jsonb_build_object('x',0,'y',140),'data',jsonb_build_object('amount', greatest(coalesce(r.minutes,0) + coalesce(r.hours,0)*60, 1), 'unit','minutes')),
      jsonb_build_object('id','send','type',v_type,'position',jsonb_build_object('x',0,'y',280),'data',jsonb_build_object('template_id', r.template_id, 'email_template_id', r.email_template_id,
        'use_personal_coupon', coalesce(r.vars->>'cupom_pessoal','') = 'true', 'vars', coalesce(r.vars,'{}'::jsonb) - 'cupom_pessoal' - 'only_if_clicked', 'rule_id', r.id)),
      jsonb_build_object('id','exit','type','exit','position',jsonb_build_object('x',0,'y',420),'data','{}'::jsonb));
    v_edges := jsonb_build_array(
      jsonb_build_object('id','e1','source','trigger','sourceHandle','out','target','wait'),
      jsonb_build_object('id','e2','source','wait','sourceHandle','out','target','send'),
      jsonb_build_object('id','e3','source','send','sourceHandle','out','target','exit'));
    UPDATE public.flows SET draft_graph = jsonb_build_object('nodes', v_nodes, 'edges', v_edges) WHERE id = v_click;
    INSERT INTO public.flow_versions (flow_id, version, graph) VALUES (v_click, 1, jsonb_build_object('nodes', v_nodes, 'edges', v_edges)) RETURNING id INTO v_ver;
    UPDATE public.flows SET live_version_id = v_ver WHERE id = v_click;
  END LOOP;
END $$;
SELECT id, name, status, jsonb_array_length(draft_graph->'nodes') nos FROM public.flows ORDER BY created_at;
