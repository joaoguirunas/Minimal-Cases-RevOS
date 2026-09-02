-- BI-REC-1 — Captura exata de reconversões da esteira.
--
-- Uma linha por PEDIDO PAGO (Yampi, trigger pedido_pago): quem pagou, quanto,
-- quantos toques a esteira tinha dado (e-mail/WhatsApp/SMS enviados via
-- followup_queue) e quando foi o último toque antes do pagamento.
--
-- `attributed` = reconvertido POR NÓS: houve >= 1 toque enviado antes do pagamento
-- e o pagamento ocorreu dentro da janela de atribuição (default 7 dias após o
-- último toque). Sem toque (ou fora da janela) fica registrado como orgânico —
-- os números exatos saem da comparação dos dois.

BEGIN;

CREATE TABLE IF NOT EXISTS public.esteira_reconversions (
    id                 uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    order_id           text NOT NULL UNIQUE,
    people_id          uuid,
    lead_id            uuid,
    order_total        numeric,
    paid_at            timestamptz NOT NULL,
    first_touch_at     timestamptz,
    last_touch_at      timestamptz,
    touches_email      integer DEFAULT 0 NOT NULL,
    touches_whatsapp   integer DEFAULT 0 NOT NULL,
    touches_sms        integer DEFAULT 0 NOT NULL,
    touches_total      integer DEFAULT 0 NOT NULL,
    hours_since_last_touch numeric,
    attributed         boolean DEFAULT false NOT NULL,
    attribution_window_days integer DEFAULT 7 NOT NULL,
    created_at         timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.esteira_reconversions IS
  'Pedidos pagos (Yampi) com a foto dos toques da esteira no momento do pagamento. attributed=true → reconvertido por nós (toque antes do pagamento, dentro da janela).';

CREATE INDEX IF NOT EXISTS esteira_reconversions_paid_idx ON public.esteira_reconversions (paid_at DESC);
CREATE INDEX IF NOT EXISTS esteira_reconversions_attr_idx ON public.esteira_reconversions (attributed, paid_at DESC);
CREATE INDEX IF NOT EXISTS esteira_reconversions_people_idx ON public.esteira_reconversions (people_id) WHERE people_id IS NOT NULL;

ALTER TABLE public.esteira_reconversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY esteira_rec_select_active_users ON public.esteira_reconversions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.settings_users su
    WHERE su.auth_user_id = auth.uid() AND su.active = true));

CREATE POLICY esteira_rec_service_role ON public.esteira_reconversions
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
