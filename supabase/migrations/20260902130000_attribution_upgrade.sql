-- BI-REC-3 — Upgrade de atribuição: cupom (prova forte) + clique rastreado.
--
-- Níveis de prova de "reconvertido por nós" (precedência):
--   'cupom'  — pedido pago usando cupom NOSSO (crm_coupons: esteira/agente/instagram)
--   'clique' — pessoa clicou num link rastreado nosso antes de pagar (janela 7d)
--   'janela' — recebeu toque enviado antes de pagar (janela 7d) — atribuição temporal
--
-- Tabelas:
--   crm_coupons    — registro dos cupons que SÃO nossos (seed VOLTA10/ULTIMA15/INSTA10;
--                    a tool yampi_criar_cupom do agente registra os personalizados)
--   tracked_links  — links curtos /functions/v1/r?t=<token> com contagem de cliques

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_coupons (
    id          uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    code        text NOT NULL UNIQUE,
    source      text NOT NULL,
    people_id   uuid,
    created_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT crm_coupons_source_check
      CHECK (source = ANY (ARRAY['esteira', 'agente', 'instagram', 'manual']))
);
COMMENT ON TABLE public.crm_coupons IS
  'Cupons emitidos POR NÓS (esteira/agente/Instagram). Pedido pago com um destes = reconversão com prova forte (attribution_level=cupom).';

INSERT INTO public.crm_coupons (code, source) VALUES
  ('VOLTA10', 'esteira'),
  ('ULTIMA15', 'esteira'),
  ('INSTA10', 'instagram')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tracked_links (
    id               uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    token            text NOT NULL UNIQUE,
    destination      text NOT NULL,
    people_id        uuid,
    lead_id          uuid,
    channel          text,
    clicks           integer DEFAULT 0 NOT NULL,
    first_clicked_at timestamptz,
    last_clicked_at  timestamptz,
    created_at       timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.tracked_links IS
  'Links curtos rastreados (edge function r): cada clique incrementa e carimba o timestamp — evidência de engajamento para atribuição.';
CREATE INDEX IF NOT EXISTS tracked_links_people_idx ON public.tracked_links (people_id, last_clicked_at DESC) WHERE people_id IS NOT NULL;

ALTER TABLE public.esteira_reconversions
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS attribution_level text,
  ADD CONSTRAINT esteira_rec_level_check
    CHECK (attribution_level IS NULL OR attribution_level = ANY (ARRAY['cupom', 'clique', 'janela']));

COMMENT ON COLUMN public.esteira_reconversions.attribution_level IS
  'cupom (usou cupom nosso) > clique (clicou em link rastreado antes de pagar) > janela (toque antes de pagar, 7d). NULL = orgânico.';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.crm_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_coupons','tracked_links'] LOOP
    EXECUTE format('CREATE POLICY %I_select_active_users ON public.%I FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.settings_users su
        WHERE su.auth_user_id = auth.uid() AND su.active = true))', t, t);
    EXECUTE format('CREATE POLICY %I_service_role ON public.%I
      USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t, t);
  END LOOP;
END $$;

COMMIT;
