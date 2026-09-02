-- YMP-7 — Redesenho dos stages da "Esteira Minimal — Loja".
--
-- O layout antigo espelhava 1:1 os eventos Yampi ("Entrou no checkout",
-- "Pedido criado"...) e deixava 99% dos leads parados numa coluna só.
-- O novo layout é o funil de RECUPERAÇÃO real:
--
--   1. Carrinho abandonado  ← carrinho_abandonado (entrada; fups da esteira aqui)
--   2. Em recuperação       ← movido pelo followup-trigger-worker no 1º toque enviado
--   3. Engajou              ← movido pela edge fn `r` quando clica em link rastreado
--   4. Pagamento pendente   ← pix_gerado / boleto_gerado / pedido_criado
--   5. Pagamento recusado   ← pagamento_recusado
--   6. Recuperado           ← pedido_pago   (cancela fups pendentes do lead)
--   7. Perdido              ← pedido_cancelado (cancela fups pendentes do lead)
--
-- checkout_iniciado fica SEM movimento (checkout ativo não é lead de recuperação;
-- o lead só entra quando o carrinho de fato abandona). Stages "Entrou no checkout"
-- e "Pedido criado" são removidos (leads movidos antes).

BEGIN;

DO $$
DECLARE
  v_pipeline  uuid;
  v_carrinho  uuid;
  v_checkout  uuid;
  v_pix       uuid;
  v_pedido    uuid;
  v_recusado  uuid;
  v_pago      uuid;
  v_cancelado uuid;
BEGIN
  SELECT id INTO v_pipeline FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja' LIMIT 1;
  IF v_pipeline IS NULL THEN RETURN; END IF;

  SELECT id INTO v_carrinho  FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Carrinho abandonado';
  SELECT id INTO v_checkout  FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Entrou no checkout';
  SELECT id INTO v_pix       FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pix/boleto gerado';
  SELECT id INTO v_pedido    FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pedido criado';
  SELECT id INTO v_recusado  FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pagamento recusado';
  SELECT id INTO v_pago      FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Compra finalizada';
  SELECT id INTO v_cancelado FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Cancelado';

  -- Renomeios (ids preservados — mapeamentos e leads não quebram)
  IF v_pix       IS NOT NULL THEN UPDATE public.leads_stages SET name = 'Pagamento pendente' WHERE id = v_pix; END IF;
  IF v_pago      IS NOT NULL THEN UPDATE public.leads_stages SET name = 'Recuperado'         WHERE id = v_pago; END IF;
  IF v_cancelado IS NOT NULL THEN UPDATE public.leads_stages SET name = 'Perdido'            WHERE id = v_cancelado; END IF;

  -- Novos stages de progressão da recuperação
  INSERT INTO public.leads_stages (leads_pipelines_id, name, color, order_index, active)
  SELECT v_pipeline, 'Em recuperação', '#3b6fd8', 1, true
  WHERE NOT EXISTS (SELECT 1 FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Em recuperação');

  INSERT INTO public.leads_stages (leads_pipelines_id, name, color, order_index, active)
  SELECT v_pipeline, 'Engajou', '#8250c8', 2, true
  WHERE NOT EXISTS (SELECT 1 FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Engajou');

  -- Leads dos stages que somem migram para o equivalente real
  IF v_pedido IS NOT NULL AND v_pix IS NOT NULL THEN
    UPDATE public.leads SET leads_stages_id = v_pix WHERE leads_stages_id = v_pedido;
  END IF;
  IF v_checkout IS NOT NULL AND v_carrinho IS NOT NULL THEN
    UPDATE public.leads SET leads_stages_id = v_carrinho WHERE leads_stages_id = v_checkout;
  END IF;

  -- Mapeamentos: pedido_criado → Pagamento pendente; checkout_iniciado → sem movimento
  IF v_pix IS NOT NULL THEN
    UPDATE public.yampi_event_mappings SET target_stage_id = v_pix WHERE trigger = 'pedido_criado';
  END IF;
  DELETE FROM public.yampi_event_mappings WHERE trigger = 'checkout_iniciado';

  -- Remove os stages que não fazem sentido real
  IF v_pedido   IS NOT NULL THEN DELETE FROM public.leads_stages WHERE id = v_pedido; END IF;
  IF v_checkout IS NOT NULL THEN DELETE FROM public.leads_stages WHERE id = v_checkout; END IF;

  -- Ordem final do funil
  UPDATE public.leads_stages SET order_index = 0 WHERE leads_pipelines_id = v_pipeline AND name = 'Carrinho abandonado';
  UPDATE public.leads_stages SET order_index = 1 WHERE leads_pipelines_id = v_pipeline AND name = 'Em recuperação';
  UPDATE public.leads_stages SET order_index = 2 WHERE leads_pipelines_id = v_pipeline AND name = 'Engajou';
  UPDATE public.leads_stages SET order_index = 3 WHERE leads_pipelines_id = v_pipeline AND name = 'Pagamento pendente';
  UPDATE public.leads_stages SET order_index = 4 WHERE leads_pipelines_id = v_pipeline AND name = 'Pagamento recusado';
  UPDATE public.leads_stages SET order_index = 5 WHERE leads_pipelines_id = v_pipeline AND name = 'Recuperado';
  UPDATE public.leads_stages SET order_index = 6 WHERE leads_pipelines_id = v_pipeline AND name = 'Perdido';
END $$;

COMMIT;
