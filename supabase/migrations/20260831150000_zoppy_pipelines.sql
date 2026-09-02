-- ZPY-3 — Pipelines do import Zoppy.
--
-- 1. "Clientes"            — TODO cliente importado da Zoppy vira lead aqui, no stage
--                            da sua segmentação RFM (position da Zoppy, read-only).
-- 2. "Carrinho Abandonado" — cada carrinho abandonado da Zoppy vira/atualiza um lead
--                            (título com o item, valor = total do carrinho).
--
-- O zoppy-sync resolve os pipelines POR NOME (constantes em _shared/zoppy-client.ts);
-- renomear os pipelines quebra o vínculo — prefira renomear stages, não pipelines.

BEGIN;

DO $$
DECLARE
  v_cli uuid;
  v_cart uuid;
BEGIN
  -- ── Pipeline Clientes (stages = RFM da Zoppy) ────────────────────────────
  SELECT id INTO v_cli FROM public.leads_pipelines WHERE name = 'Clientes';
  IF v_cli IS NULL THEN
    INSERT INTO public.leads_pipelines (name, description, active, order_index)
    VALUES ('Clientes', 'Base completa de clientes (import Zoppy). Stages seguem a segmentação RFM da Zoppy.', true, 1)
    RETURNING id INTO v_cli;
  END IF;

  INSERT INTO public.leads_stages (leads_pipelines_id, name, color, order_index, active)
  SELECT v_cli, s.name, s.color, s.ord, true
  FROM (VALUES
    ('Sem classificação', '#8f8c85', 0),
    ('Promissores',       '#3b6fd8', 1),
    ('Possíveis fiéis',   '#d9a406', 2),
    ('Fiéis',             '#1f8f5b', 3),
    ('Em risco',          '#e8632b', 4),
    ('Dormindo',          '#77746d', 5)
  ) AS s(name, color, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.leads_stages ls
    WHERE ls.leads_pipelines_id = v_cli AND ls.name = s.name
  );

  -- ── Pipeline Carrinho Abandonado (histórico Zoppy) ───────────────────────
  SELECT id INTO v_cart FROM public.leads_pipelines WHERE name = 'Carrinho Abandonado';
  IF v_cart IS NULL THEN
    INSERT INTO public.leads_pipelines (name, description, active, order_index)
    VALUES ('Carrinho Abandonado', 'Carrinhos abandonados importados da Zoppy — base para recuperação ativa.', true, 2)
    RETURNING id INTO v_cart;
  END IF;

  INSERT INTO public.leads_stages (leads_pipelines_id, name, color, order_index, active)
  SELECT v_cart, s.name, s.color, s.ord, true
  FROM (VALUES
    ('Carrinho abandonado', '#e8632b', 0),
    ('Em recuperação',      '#d9a406', 1),
    ('Recuperado',          '#1f8f5b', 2),
    ('Perdido',             '#77746d', 3)
  ) AS s(name, color, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.leads_stages ls
    WHERE ls.leads_pipelines_id = v_cart AND ls.name = s.name
  );
END $$;

COMMIT;
