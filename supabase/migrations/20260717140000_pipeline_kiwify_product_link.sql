-- Permite vincular um leads_pipelines a um produto Kiwify: todo lead desse
-- produto (novo, via webhook, ou já existente) passa a cair nesse pipeline.
-- Não recria o roteamento — reusa kiwify_event_mappings (já lido por
-- kiwify-process-event) como fonte de verdade; as colunas novas em
-- leads_pipelines são só a camada de conveniência/UI, sincronizada pelas
-- RPCs abaixo.

-- ── 1. Colunas + unique constraints ─────────────────────────────────────────

ALTER TABLE public.leads_pipelines
  ADD COLUMN IF NOT EXISTS kiwify_product_id text,
  ADD COLUMN IF NOT EXISTS kiwify_product_name text;

CREATE UNIQUE INDEX IF NOT EXISTS leads_pipelines_kiwify_product_id_uq
  ON public.leads_pipelines (kiwify_product_id)
  WHERE kiwify_product_id IS NOT NULL;

-- Fecha um risco latente: kiwify-process-event's loadMapping() usa
-- .maybeSingle() por (trigger, product_id) — sem esse constraint, 2 linhas
-- ativas pro mesmo par faria o processamento do webhook quebrar. Também
-- necessário pro ON CONFLICT das RPCs abaixo. Checado antes de aplicar: zero
-- duplicatas ativas hoje.
ALTER TABLE public.kiwify_event_mappings
  ADD CONSTRAINT kiwify_event_mappings_trigger_product_uq UNIQUE (trigger, product_id);

-- ── 2. RLS: leads_pipelines/leads_stages estavam com escrita liberada pra
-- qualquer usuário autenticado (inclusive 'comercial') — aperta pro mesmo
-- padrão já usado nas tabelas kiwify_* (kiwify_write_managers).

DROP POLICY IF EXISTS authenticated_write ON public.leads_pipelines;
CREATE POLICY managers_write_pipelines ON public.leads_pipelines
  FOR ALL
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());

DROP POLICY IF EXISTS authenticated_write ON public.leads_stages;
CREATE POLICY managers_write_stages ON public.leads_stages
  FOR ALL
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());

-- ── 3. RPC: vincula pipeline a produto ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.link_pipeline_to_kiwify_product(
  p_pipeline_id uuid,
  p_product_id text,
  p_product_name text,
  p_move_existing_leads boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_product_id text;
  v_conflicting_pipeline_id uuid;
  v_conflicting_pipeline_name text;
  v_first_stage_id uuid;
  v_trigger text;
  v_mappings_synced int := 0;
  v_leads_moved int := 0;
  v_triggers text[] := ARRAY[
    'boleto_gerado', 'pix_gerado', 'carrinho_abandonado', 'compra_recusada',
    'compra_aprovada', 'compra_reembolsada', 'chargeback',
    'subscription_canceled', 'subscription_late', 'subscription_renewed'
  ];
BEGIN
  IF NOT is_admin_or_manager() THEN
    RAISE EXCEPTION 'Apenas admin/manager pode vincular pipeline a produto';
  END IF;

  IF p_product_id IS NULL OR trim(p_product_id) = '' THEN
    RAISE EXCEPTION 'p_product_id é obrigatório';
  END IF;

  SELECT id, name INTO v_conflicting_pipeline_id, v_conflicting_pipeline_name
  FROM leads_pipelines
  WHERE kiwify_product_id = p_product_id AND id <> p_pipeline_id;

  IF v_conflicting_pipeline_id IS NOT NULL THEN
    RAISE EXCEPTION 'Produto já vinculado ao pipeline "%" — desvincule primeiro', v_conflicting_pipeline_name;
  END IF;

  SELECT id INTO v_first_stage_id
  FROM leads_stages
  WHERE leads_pipelines_id = p_pipeline_id AND active = true
  ORDER BY order_index ASC
  LIMIT 1;

  IF v_first_stage_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline não tem nenhuma etapa ativa — crie uma etapa antes de vincular um produto';
  END IF;

  SELECT kiwify_product_id INTO v_old_product_id
  FROM leads_pipelines WHERE id = p_pipeline_id;

  IF v_old_product_id IS NOT NULL AND v_old_product_id <> p_product_id THEN
    UPDATE kiwify_event_mappings
    SET active = false, updated_at = now()
    WHERE product_id = v_old_product_id AND target_pipeline_id = p_pipeline_id;
  END IF;

  UPDATE leads_pipelines
  SET kiwify_product_id = p_product_id, kiwify_product_name = p_product_name, updated_at = now()
  WHERE id = p_pipeline_id;

  FOREACH v_trigger IN ARRAY v_triggers LOOP
    INSERT INTO kiwify_event_mappings (product_id, trigger, target_pipeline_id, target_stage_id, active)
    VALUES (p_product_id, v_trigger, p_pipeline_id, v_first_stage_id, true)
    ON CONFLICT (trigger, product_id)
    DO UPDATE SET target_pipeline_id = excluded.target_pipeline_id,
                  target_stage_id = excluded.target_stage_id,
                  active = true,
                  updated_at = now();
    v_mappings_synced := v_mappings_synced + 1;
  END LOOP;

  IF p_move_existing_leads THEN
    WITH moved AS (
      UPDATE leads
      SET leads_pipelines_id = p_pipeline_id, leads_stages_id = v_first_stage_id, updated_at = now()
      WHERE people_id IN (SELECT people_id FROM kiwify_lead_products WHERE product_id = p_product_id)
        AND status NOT IN ('lost', 'archived')
        AND leads_pipelines_id <> p_pipeline_id
      RETURNING id
    )
    SELECT count(*) INTO v_leads_moved FROM moved;
  END IF;

  RETURN jsonb_build_object('mappings_synced', v_mappings_synced, 'leads_moved', v_leads_moved);
END;
$$;

-- ── 4. RPC: desvincula pipeline de produto ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.unlink_pipeline_kiwify_product(
  p_pipeline_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id text;
  v_mappings_deactivated int := 0;
BEGIN
  IF NOT is_admin_or_manager() THEN
    RAISE EXCEPTION 'Apenas admin/manager pode desvincular pipeline de produto';
  END IF;

  SELECT kiwify_product_id INTO v_product_id FROM leads_pipelines WHERE id = p_pipeline_id;

  IF v_product_id IS NULL THEN
    RETURN jsonb_build_object('mappings_deactivated', 0);
  END IF;

  UPDATE leads_pipelines
  SET kiwify_product_id = NULL, kiwify_product_name = NULL, updated_at = now()
  WHERE id = p_pipeline_id;

  WITH deactivated AS (
    UPDATE kiwify_event_mappings
    SET active = false, updated_at = now()
    WHERE product_id = v_product_id AND target_pipeline_id = p_pipeline_id AND active = true
    RETURNING id
  )
  SELECT count(*) INTO v_mappings_deactivated FROM deactivated;

  RETURN jsonb_build_object('mappings_deactivated', v_mappings_deactivated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_pipeline_to_kiwify_product(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_pipeline_kiwify_product(uuid) TO authenticated;
