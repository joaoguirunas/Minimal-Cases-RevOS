-- YMP-4 — Esteira da loja: pipeline padrão + mapeamento evento Yampi → stage.
--
-- 1. yampi_event_mappings — um mapping por trigger (UNIQUE): quando o evento chega,
--    yampi-process-event move (ou cria) o lead do contato para o stage mapeado.
--    Editável na UI da integração (Configurações → Integrações → Yampi → Esteira).
-- 2. Seed do pipeline "Esteira Minimal — Loja" com 7 stages e os mappings default.
--    Idempotente: nada é recriado se o pipeline já existir.
-- 3. pg_cron: yampi-reconcile a cada 5 min — sintetiza `checkout_iniciado` a partir de
--    GET /checkout/carts (a Yampi não tem webhook de "entrou no checkout"; o carrinho
--    aparece na API assim que o cliente se identifica) e reprocessa eventos presos.
--
-- Triggers canônicos (ordem de vida — usado também no precedence guard):
--   checkout_iniciado(0) → carrinho_abandonado(1) → pix_gerado/boleto_gerado/
--   pedido_criado(2) → pagamento_recusado(3) → pedido_pago(4) → pedido_cancelado(5).
--   pedido_status_atualizado é informativo (sem mapping default).

BEGIN;

-- ── 1. Mapping table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yampi_event_mappings (
    id                  uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    trigger             text NOT NULL UNIQUE,
    target_pipeline_id  uuid NOT NULL REFERENCES public.leads_pipelines(id) ON DELETE CASCADE,
    target_stage_id     uuid NOT NULL REFERENCES public.leads_stages(id) ON DELETE CASCADE,
    tags_to_add         text[] DEFAULT '{}'::text[] NOT NULL,
    tags_to_remove      text[] DEFAULT '{}'::text[] NOT NULL,
    active              boolean DEFAULT true NOT NULL,
    created_at          timestamptz DEFAULT now() NOT NULL,
    updated_at          timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.yampi_event_mappings IS
  'Evento Yampi (trigger canônico) → pipeline/stage do CRM. Um mapping por trigger; a esteira da loja é única (YMP-4).';

ALTER TABLE public.yampi_event_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY yampi_select_active_users ON public.yampi_event_mappings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.settings_users su
    WHERE su.auth_user_id = auth.uid() AND su.active = true));

CREATE POLICY yampi_write_managers ON public.yampi_event_mappings
  USING (EXISTS (
    SELECT 1 FROM public.settings_users su
    WHERE su.auth_user_id = auth.uid() AND su.active = true
      AND (su.super_admin = true OR su.user_type = 'manager')))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.settings_users su
    WHERE su.auth_user_id = auth.uid() AND su.active = true
      AND (su.super_admin = true OR su.user_type = 'manager')));

CREATE POLICY yampi_service_role ON public.yampi_event_mappings
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'CREATE TRIGGER yampi_event_mappings_updated_at BEFORE UPDATE ON public.yampi_event_mappings
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

-- ── 2. Seed: pipeline "Esteira Minimal — Loja" + stages + mappings ────────────

DO $$
DECLARE
  v_pipeline uuid;
  v_stage_checkout   uuid;
  v_stage_abandonado uuid;
  v_stage_pix        uuid;
  v_stage_pedido     uuid;
  v_stage_recusado   uuid;
  v_stage_pago       uuid;
  v_stage_cancelado  uuid;
BEGIN
  SELECT id INTO v_pipeline FROM public.leads_pipelines WHERE name = 'Esteira Minimal — Loja';
  IF v_pipeline IS NULL THEN
    INSERT INTO public.leads_pipelines (name, description, active, order_index)
    VALUES (
      'Esteira Minimal — Loja',
      'Funil da loja Yampi: do checkout iniciado à compra finalizada. Stages movidos automaticamente pelos eventos da integração Yampi.',
      true,
      0
    ) RETURNING id INTO v_pipeline;
  END IF;

  -- Stages (idempotentes por nome dentro do pipeline)
  INSERT INTO public.leads_stages (leads_pipelines_id, name, color, order_index, active)
  SELECT v_pipeline, s.name, s.color, s.ord, true
  FROM (VALUES
    ('Entrou no checkout',   '#8f8c85', 0),
    ('Carrinho abandonado',  '#e8632b', 1),
    ('Pix/boleto gerado',    '#d9a406', 2),
    ('Pedido criado',        '#3b6fd8', 3),
    ('Pagamento recusado',   '#c0392b', 4),
    ('Compra finalizada',    '#1f8f5b', 5),
    ('Cancelado',            '#77746d', 6)
  ) AS s(name, color, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.leads_stages ls
    WHERE ls.leads_pipelines_id = v_pipeline AND ls.name = s.name
  );

  SELECT id INTO v_stage_checkout   FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Entrou no checkout';
  SELECT id INTO v_stage_abandonado FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Carrinho abandonado';
  SELECT id INTO v_stage_pix        FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pix/boleto gerado';
  SELECT id INTO v_stage_pedido     FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pedido criado';
  SELECT id INTO v_stage_recusado   FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Pagamento recusado';
  SELECT id INTO v_stage_pago       FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Compra finalizada';
  SELECT id INTO v_stage_cancelado  FROM public.leads_stages WHERE leads_pipelines_id = v_pipeline AND name = 'Cancelado';

  -- Mappings default (um por trigger; não sobrescreve configuração existente)
  INSERT INTO public.yampi_event_mappings (trigger, target_pipeline_id, target_stage_id, active)
  SELECT m.trigger, v_pipeline, m.stage, true
  FROM (VALUES
    ('checkout_iniciado',   v_stage_checkout),
    ('carrinho_abandonado', v_stage_abandonado),
    ('pix_gerado',          v_stage_pix),
    ('boleto_gerado',       v_stage_pix),
    ('pedido_criado',       v_stage_pedido),
    ('pagamento_recusado',  v_stage_recusado),
    ('pedido_pago',         v_stage_pago),
    ('pedido_cancelado',    v_stage_cancelado)
  ) AS m(trigger, stage)
  WHERE m.stage IS NOT NULL
  ON CONFLICT (trigger) DO NOTHING;
END $$;

COMMIT;

-- ── 3. pg_cron: yampi-reconcile a cada 5 min ─────────────────────────────────
-- Mesmo mecanismo do kiwify_reconcile: secure_http_post lê o service-role JWT do
-- Vault ('service_role_cron'); a função valida a claim role=service_role.
-- Se o secret não existir, o job é pulado com NOTICE e a migration passa.

DO $$
DECLARE
  v_has_secret boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_cron') INTO v_has_secret;

  IF NOT v_has_secret THEN
    RAISE NOTICE 'Vault secret service_role_cron não encontrado — pulando cron yampi_reconcile. Crie o secret e rode esta migration de novo.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yampi_reconcile';

  PERFORM cron.schedule(
    'yampi_reconcile',
    '*/5 * * * *',
    $cron$
    SELECT public.secure_http_post(
      'service_role_cron',
      'https://maigkwlgzinykfvemexf.supabase.co/functions/v1/yampi-reconcile',
      '{"source":"pg_cron"}'::jsonb,
      'yampi-reconcile-cron'
    );
    $cron$
  );
END $$;
